require("dotenv").config();


const express = require("express");
const path = require("path");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const JSZip = require("jszip");

const supabase = require("./supabase");

const app = express();

const PORT = process.env.PORT || 3000;


// ========================================
// GOOGLE AUTH
// ========================================

const GOOGLE_CLIENT_ID =
    "132884412252-jokiu99i47enkg2ciugap6lqpgfk7vnk.apps.googleusercontent.com";

const googleClient =
    new OAuth2Client(GOOGLE_CLIENT_ID);


// Only these 2 emails can access admin
const ALLOWED_EMAILS = [
    "raveendiran15@gmail.com",
    "rithvikraghav11@gmail.com"
];

console.log(
    "Allowed admin emails:",
    ALLOWED_EMAILS
);


const JWT_SECRET =
    process.env.SESSION_SECRET;


if (!JWT_SECRET) {
    console.warn(
        "WARNING: SESSION_SECRET is not configured."
    );
}


// ========================================
// MIDDLEWARE
// ========================================

app.use(
    express.json({
        limit: "10mb"
    })
);

app.use(cookieParser());

app.use(
    express.static(
        path.join(__dirname, "../public")
    )
);


// ========================================
// IMAGE UPLOAD
// ========================================

const upload = multer({

    storage:
        multer.memoryStorage(),

    limits: {
        fileSize:
            4 * 1024 * 1024
    },

    fileFilter:
        (req, file, cb) => {

            if (
                file.mimetype.startsWith(
                    "image/"
                )
            ) {

                cb(null, true);

            } else {

                cb(
                    new Error(
                        "Only image files are allowed"
                    )
                );

            }

        }

});


// ========================================
// ADMIN AUTH MIDDLEWARE
// ========================================

function requireAdmin(
    req,
    res,
    next
) {

    try {

        if (!JWT_SECRET) {

            return res.status(500).json({
                success: false,
                message:
                    "Server authentication is not configured."
            });

        }


        const token =
            req.cookies.adminToken;


        if (!token) {

            return res.status(401).json({
                success: false,
                message:
                    "Unauthorized. Please login."
            });

        }


        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );


        const email =
            String(
                decoded.email || ""
            )
                .trim()
                .toLowerCase();


        if (
            !email ||
            !ALLOWED_EMAILS.includes(
                email
            )
        ) {

            return res.status(401).json({
                success: false,
                message:
                    "Unauthorized."
            });

        }


        req.admin = {
            email: email
        };


        next();


    } catch (error) {

        console.error(
            "Admin authentication error:",
            error.message
        );


        return res.status(401).json({
            success: false,
            message:
                "Unauthorized. Please login."
        });

    }

}


// ========================================
// GOOGLE LOGIN
// ========================================

app.post(
    "/api/admin/google-login",
    async (req, res) => {

        try {

            const {
                credential
            } = req.body;


            if (!credential) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Google credential is missing."
                });

            }


            // Verify Google's ID token
            const ticket =
                await googleClient.verifyIdToken({

                    idToken:
                        credential,

                    audience:
                        GOOGLE_CLIENT_ID

                });


            const payload =
                ticket.getPayload();


            if (!payload) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Invalid Google account."
                });

            }


            const email =
                String(
                    payload.email || ""
                )
                    .trim()
                    .toLowerCase();


            const emailVerified =
                payload.email_verified === true;


            // Google must confirm the email
            if (!emailVerified) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Your Google email is not verified."
                });

            }


            // Check if email is one of our 2 accounts
            if (
                !ALLOWED_EMAILS.includes(
                    email
                )
            ) {

                console.log(
                    "Unauthorized Google login:",
                    email
                );


                return res.status(403).json({
                    success: false,
                    message:
                        "This Google account is not authorized to access the admin panel."
                });

            }


            // Create JWT
            const token =
                jwt.sign(

                    {
                        email: email
                    },

                    JWT_SECRET,

                    {
                        expiresIn:
                            "1d"
                    }

                );


            // Store token securely in cookie
            res.cookie(
                "adminToken",
                token,
                {
                    httpOnly: true,

                    secure:
                        process.env.NODE_ENV ===
                        "production",

                    sameSite:
                        "lax",

                    maxAge:
                        24 *
                        60 *
                        60 *
                        1000
                }
            );


            console.log(
                "Admin Google login successful:",
                email
            );


            return res.json({

                success: true,

                message:
                    "Login successful",

                email:
                    email

            });


        } catch (error) {

            console.error(
                "Google login error:",
                error
            );


            return res.status(401).json({
                success: false,
                message:
                    "Google login failed."
            });

        }

    }
);


// ========================================
// LOGOUT
// ========================================

app.post(
    "/api/admin/logout",
    (req, res) => {

        res.clearCookie(
            "adminToken",
            {
                httpOnly: true,

                secure:
                    process.env.NODE_ENV ===
                    "production",

                sameSite:
                    "lax"
            }
        );


        res.json({
            success: true,
            message:
                "Logged out successfully"
        });

    }
);


// ========================================
// CHECK LOGIN
// ========================================

app.get(
    "/api/admin/check",
    (req, res) => {

        try {

            if (!JWT_SECRET) {

                return res.json({
                    loggedIn: false
                });

            }


            const token =
                req.cookies.adminToken;


            if (!token) {

                return res.json({
                    loggedIn: false
                });

            }


            const decoded =
                jwt.verify(
                    token,
                    JWT_SECRET
                );


            const email =
                String(
                    decoded.email || ""
                )
                    .trim()
                    .toLowerCase();


            if (
                !email ||
                !ALLOWED_EMAILS.includes(
                    email
                )
            ) {

                return res.json({
                    loggedIn: false
                });

            }


            return res.json({

                loggedIn: true,

                email:
                    email

            });


        } catch (error) {

            return res.json({
                loggedIn: false
            });

        }

    }
);


// ========================================
// IMAGE UPLOAD API
// ========================================

app.post(
    "/api/upload-image",

    requireAdmin,

    upload.single("image"),

    async (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({
                    message:
                        "No image selected"
                });

            }


            const originalName =
                path
                    .parse(
                        req.file.originalname
                    )
                    .name
                    .toLowerCase()
                    .replace(
                        /[^a-z0-9]+/g,
                        "-"
                    )
                    .replace(
                        /^-|-$/g,
                        ""
                    );


            const extension =
                path
                    .extname(
                        req.file.originalname
                    )
                    .toLowerCase();


            const fileName =
                `${Date.now()}-${originalName}${extension}`;


            const filePath =
                `menu/${fileName}`;


            const {
                error: uploadError
            } =
                await supabase.storage
                    .from(
                        "menu-images"
                    )
                    .upload(
                        filePath,
                        req.file.buffer,
                        {
                            contentType:
                                req.file.mimetype,

                            upsert:
                                false
                        }
                    );


            if (uploadError) {

                console.error(
                    "Supabase Storage upload error:",
                    uploadError
                );


                return res.status(500).json({
                    message:
                        "Failed to upload image"
                });

            }


            const { data } =
                supabase.storage
                    .from(
                        "menu-images"
                    )
                    .getPublicUrl(
                        filePath
                    );


            return res.json({

                success: true,

                imageUrl:
                    data.publicUrl

            });


        } catch (error) {

            console.error(
                "Image upload error:",
                error
            );


            return res.status(500).json({

                message:
                    error.message ||
                    "Image upload failed"

            });

        }

    }
);


// ========================================
// MENU API
// ========================================

// PUBLIC MENU
app.get(
    "/api/menu",
    async (req, res) => {

        try {

            const {
                data,
                error
            } =
                await supabase
                    .from(
                        "menu_items"
                    )
                    .select("*")
                    .order(
                        "name",
                        {
                            ascending: true
                        }
                    );


            if (error) {

                console.error(
                    "Supabase GET error:",
                    error
                );


                return res.status(500).json({
                    message:
                        "Failed to load menu"
                });

            }


            res.json(data);


        } catch (error) {

            console.error(error);


            res.status(500).json({
                message:
                    "Server error"
            });

        }

    }
);

// ========================================
// RESTAURANT ONBOARDING API
// ========================================

function createRestaurantSlug(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

app.post(
    "/api/restaurants",
    requireAdmin,
    async (req, res) => {
        try {
            const {
                restaurantName,
                ownerName,
                mobile,
                email,
                city,
                slug,
                price,
                plan,
                paymentReceived,
                websiteSource,
                repositoryUrl,
                branch,
                websiteFolder
            } = req.body;

            // Validate required fields.
            if (
                !restaurantName ||
                !ownerName ||
                !mobile ||
                !city
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Restaurant name, owner name, mobile number and city are required."
                });
            }

            // Validate mobile number.
            if (!/^[0-9]{10}$/.test(String(mobile))) {
                return res.status(400).json({
                    success: false,
                    message: "Enter a valid 10-digit mobile number."
                });
            }

            // Validate price.
            const onboardingPrice = Number(price);

            if (
                !Number.isFinite(onboardingPrice) ||
                onboardingPrice < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Enter a valid onboarding price."
                });
            }

            // Validate subscription plan.
            const allowedPlans = [
                "one-time",
                "monthly",
                "yearly"
            ];

            if (!allowedPlans.includes(plan)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid subscription plan."
                });
            }

            // Create a safe slug.
            const restaurantSlug = createRestaurantSlug(
                slug || restaurantName
            );

            if (
                !restaurantSlug ||
                restaurantSlug.length > 80
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Enter a valid restaurant slug."
                });
            }

            // Validate website source.
            if (
                websiteSource &&
                !["upload", "github"].includes(websiteSource)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid website source."
                });
            }

            // Validate repository URL if GitHub was selected.
            if (websiteSource === "github") {
                let repository;

                try {
                    repository = new URL(repositoryUrl);
                } catch {
                    return res.status(400).json({
                        success: false,
                        message: "Enter a valid GitHub repository URL."
                    });
                }

                if (
                    repository.protocol !== "https:" ||
                    repository.hostname !== "github.com" ||
                    repository.username ||
                    repository.password ||
                    repository.search ||
                    repository.hash
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Only standard HTTPS GitHub repository URLs are supported."
                    });
                }

                const parts = repository.pathname
                    .split("/")
                    .filter(Boolean);

                if (
                    parts.length !== 2 ||
                    parts.some(part => part === "." || part === "..")
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Enter a repository URL in the format https://github.com/owner/repository."
                    });
                }
            }

            // Insert restaurant into Supabase.
            const { data, error } = await supabase
                .from("restaurants")
                .insert({
                    restaurant_name: String(
                        restaurantName
                    ).trim(),

                    owner_name: String(
                        ownerName
                    ).trim(),

                    mobile: String(mobile).trim(),

                    email: email
                        ? String(email).trim()
                        : null,

                    city: String(city).trim(),

                    slug: restaurantSlug,

                    onboarding_price: onboardingPrice,

                    plan,

                    payment_received:
                        paymentReceived === true,

                    website_source: websiteSource || null,

                    website_status: "pending",

                    github_repository:
                        websiteSource === "github"
                            ? repositoryUrl.trim()
                            : null,

                    github_branch:
                        websiteSource === "github"
                            ? String(branch || "main").trim()
                            : null,

                    github_folder:
                        websiteSource === "github"
                            ? String(websiteFolder || "").trim()
                            : null
                })
                .select(
                    "id, restaurant_name, owner_name, mobile, email, city, slug, onboarding_price, plan, payment_received, website_source, website_status, created_at"
                )
                .single();

            if (error) {
                console.error(
                    "Restaurant creation failed:",
                    error.code,
                    error.message
                );

                if (error.code === "23505") {
                    return res.status(409).json({
                        success: false,
                        message:
                            "This mobile number or website slug is already registered."
                    });
                }

                return res.status(500).json({
                    success: false,
                    message: "Failed to create restaurant."
                });
            }

            return res.status(201).json({
                success: true,
                message:
                    "Restaurant created. Website setup is pending.",
                restaurant: data
            });

        } catch (error) {
            console.error(
                "Restaurant onboarding error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message: "An unexpected server error occurred."
            });
        }
    }
);

// ========================================
// RESTAURANT WEBSITE UPLOAD + PUBLISHING
// Required Supabase Storage buckets:
//   website-uploads  (private)
//   restaurant-sites (public)
// ========================================
const MAX_ZIP_BYTES = 5 * 1024 * 1024;
const MAX_UNZIPPED_BYTES = 25 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 500;
const UPLOAD_BUCKET = "website-uploads";
const SITE_BUCKET = "restaurant-sites";

function safeWebsitePath(value) {
    const normalized = String(value || "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");
    if (!normalized || normalized.split("/").some(part => !part || part === "." || part === "..")) return null;
    if (normalized.includes("\0")) return null;
    return normalized;
}

function isAllowedWebsiteFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return [".html", ".htm", ".css", ".js", ".mjs", ".json", ".txt", ".xml", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".avif", ".mp4", ".webm", ".woff", ".woff2", ".ttf", ".otf", ".pdf", ".md"].includes(ext);
}

// Step 1: after the restaurant record is created, request a signed URL.
app.post("/api/restaurants/:slug/upload-url", requireAdmin, async (req, res) => {
    try {
        const slug = createRestaurantSlug(req.params.slug);
        const { data: restaurant, error: restaurantError } = await supabase
            .from("restaurants").select("id, slug, website_source").eq("slug", slug).single();
        if (restaurantError || !restaurant) return res.status(404).json({ message: "Restaurant not found." });
        if (restaurant.website_source !== "upload") return res.status(400).json({ message: "This restaurant is not configured for ZIP upload." });

        const zipPath = `${slug}/${Date.now()}-${require("crypto").randomBytes(6).toString("hex")}.zip`;
        const { data, error } = await supabase.storage.from(UPLOAD_BUCKET).createSignedUploadUrl(zipPath, { upsert: true });
        if (error) {
            console.error("Could not create signed upload URL:", error.message);
            return res.status(500).json({ message: `Storage upload setup failed. Ensure the private '${UPLOAD_BUCKET}' bucket exists.` });
        }
        return res.json({ path: zipPath, token: data.token, signedUrl: data.signedUrl, bucket: UPLOAD_BUCKET });
    } catch (error) {
        console.error("Upload URL error:", error.message);
        return res.status(500).json({ message: "Could not prepare website upload." });
    }
});

// Step 2: server downloads the ZIP from Storage, validates it, and publishes files.
app.post("/api/restaurants/:slug/publish", requireAdmin, async (req, res) => {
    const slug = createRestaurantSlug(req.params.slug);
    try {
        const { path: zipPath } = req.body || {};
        if (!zipPath || !String(zipPath).startsWith(`${slug}/`) || String(zipPath).includes("..")) {
            return res.status(400).json({ message: "Invalid uploaded ZIP path." });
        }
        const { data: restaurant, error: restaurantError } = await supabase
            .from("restaurants").select("id, slug, website_source").eq("slug", slug).single();
        if (restaurantError || !restaurant) return res.status(404).json({ message: "Restaurant not found." });

        await supabase.from("restaurants").update({ website_status: "building" }).eq("slug", slug);
        const { data: zipBlob, error: downloadError } = await supabase.storage.from(UPLOAD_BUCKET).download(zipPath);
        if (downloadError || !zipBlob) throw new Error("Could not read the uploaded ZIP from Storage.");
        if (zipBlob.size > MAX_ZIP_BYTES) throw new Error("ZIP exceeds the 5 MB limit.");

        const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer(), { checkCRC32: true });
        const entries = Object.values(zip.files).filter(entry => !entry.dir);
        if (!entries.length || entries.length > MAX_ZIP_ENTRIES) throw new Error(`ZIP must contain 1–${MAX_ZIP_ENTRIES} files.`);

        // Accept either index.html at ZIP root or one top-level project folder.
        let prefix = "";
        if (!zip.files["index.html"]) {
            const roots = [...new Set(entries.map(entry => entry.name.split("/")[0]))];
            if (roots.length === 1 && zip.files[`${roots[0]}/index.html`]) prefix = `${roots[0]}/`;
        }
        if (!zip.files[`${prefix}index.html`]) throw new Error("ZIP must contain index.html at its root or inside one top-level folder.");

        let totalBytes = 0;
        const publishFiles = [];
        for (const entry of entries) {
            let relative = entry.name.startsWith(prefix) ? entry.name.slice(prefix.length) : entry.name;
            if (!relative) continue;
            const safePath = safeWebsitePath(relative);
            if (!safePath || !isAllowedWebsiteFile(safePath)) throw new Error(`Unsupported or unsafe file in ZIP: ${entry.name}`);
            const buffer = await entry.async("nodebuffer");
            totalBytes += buffer.length;
            if (totalBytes > MAX_UNZIPPED_BYTES) throw new Error("Uncompressed website exceeds the 25 MB limit.");
            publishFiles.push({ path: safePath, buffer });
        }

        // Remove previous published files for this slug before uploading the new version.
        let offset = 0;
        while (true) {
            const { data: oldFiles, error: listError } = await supabase.storage.from(SITE_BUCKET).list(slug, { limit: 100, offset });
            if (listError) throw new Error("Could not inspect existing published website files. Check the public storage bucket.");
            if (!oldFiles || !oldFiles.length) break;
            const oldPaths = oldFiles.filter(item => item.name).map(item => `${slug}/${item.name}`);
            if (oldPaths.length) await supabase.storage.from(SITE_BUCKET).remove(oldPaths);
            if (oldFiles.length < 100) break;
            offset += oldFiles.length;
        }

        for (const file of publishFiles) {
            const destination = `${slug}/${file.path}`;
            const { error: uploadError } = await supabase.storage.from(SITE_BUCKET).upload(destination, file.buffer, {
                contentType: require("mime-types").lookup(file.path) || "application/octet-stream",
                upsert: true,
                cacheControl: "3600"
            });
            if (uploadError) throw new Error(`Failed to publish ${file.path}: ${uploadError.message}`);
        }

        const { error: updateError } = await supabase.from("restaurants").update({
            website_status: "published",
            website_path: `${slug}/index.html`,
            updated_at: new Date().toISOString()
        }).eq("slug", slug);
        if (updateError) throw new Error("Files were uploaded, but the restaurant status could not be updated.");

        await supabase.storage.from(UPLOAD_BUCKET).remove([zipPath]);
        return res.json({ success: true, message: "Website published successfully.", url: `/${slug}` });
    } catch (error) {
        console.error("Website publishing failed:", error.message);
        await supabase.from("restaurants").update({ website_status: "failed" }).eq("slug", slug);
        return res.status(500).json({ message: error.message || "Website publishing failed." });
    }
});


// Import and publish a public GitHub repository.
// Supports static websites at repository root or in a selected folder (for example dist/).
// React/Vite source projects must provide their built static output folder; this endpoint does not run npm build.
app.post("/api/restaurants/:slug/import-github", requireAdmin, async (req, res) => {
    const slug = createRestaurantSlug(req.params.slug);
    try {
        const { data: restaurant, error: restaurantError } = await supabase
            .from("restaurants")
            .select("id, slug, website_source, github_repository, github_branch, github_folder")
            .eq("slug", slug)
            .single();

        if (restaurantError || !restaurant) {
            return res.status(404).json({ success: false, message: "Restaurant not found." });
        }
        if (restaurant.website_source !== "github" || !restaurant.github_repository) {
            return res.status(400).json({ success: false, message: "This restaurant is not configured for GitHub import." });
        }

        const repoUrl = new URL(restaurant.github_repository);
        if (repoUrl.protocol !== "https:" || repoUrl.hostname !== "github.com") {
            return res.status(400).json({ success: false, message: "Only public HTTPS GitHub repositories are supported." });
        }
        const parts = repoUrl.pathname.split("/").filter(Boolean);
        if (parts.length !== 2 || parts.some(part => part === "." || part === "..")) {
            return res.status(400).json({ success: false, message: "Repository URL must look like https://github.com/owner/repository." });
        }

        const owner = parts[0];
        const repo = parts[1].replace(/\.git$/i, "");
        const branch = String(restaurant.github_branch || "main").trim();
        if (!branch || branch.length > 200 || branch.includes("..")) {
            return res.status(400).json({ success: false, message: "Invalid GitHub branch." });
        }

        await supabase.from("restaurants")
            .update({ website_status: "building", updated_at: new Date().toISOString() })
            .eq("slug", slug);

        const archiveUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zipball/${encodeURIComponent(branch)}`;
        const githubResponse = await fetch(archiveUrl, {
            headers: {
                "Accept": "application/vnd.github+json",
                "User-Agent": "VignaDigital-Website-Importer"
            },
            redirect: "follow"
        });

        if (!githubResponse.ok) {
            const message = githubResponse.status === 404
                ? "GitHub repository or branch was not found. Check the repository URL and branch name."
                : githubResponse.status === 403
                    ? "GitHub rate limit or repository access denied. Try again later; only public repositories are supported."
                    : `GitHub download failed (${githubResponse.status}).`;
            throw new Error(message);
        }

        const declaredLength = Number(githubResponse.headers.get("content-length") || 0);
        if (declaredLength && declaredLength > MAX_ZIP_BYTES) {
            throw new Error("GitHub archive exceeds the 5 MB limit. For a React/Vite project, publish a smaller built static folder or use ZIP upload.");
        }
        const archiveArrayBuffer = await githubResponse.arrayBuffer();
        if (archiveArrayBuffer.byteLength > MAX_ZIP_BYTES) {
            throw new Error("GitHub archive exceeds the 5 MB limit.");
        }

        const zip = await JSZip.loadAsync(archiveArrayBuffer, { checkCRC32: true });
        const entries = Object.values(zip.files).filter(entry => !entry.dir);
        if (!entries.length || entries.length > MAX_ZIP_ENTRIES) {
            throw new Error(`GitHub repository must contain 1–${MAX_ZIP_ENTRIES} files in the selected website folder.`);
        }

        // GitHub ZIP archives include one generated top-level directory.
        const rootPrefix = entries[0].name.split("/")[0] + "/";
        const selectedFolderRaw = String(restaurant.github_folder || req.body?.websiteFolder || "").trim();
        const selectedFolder = selectedFolderRaw
            ? safeWebsitePath(selectedFolderRaw.replace(/\/+$/, ""))
            : "";
        if (selectedFolderRaw && !selectedFolder) {
            throw new Error("Website folder path is invalid.");
        }

        const candidates = [];
        for (const entry of entries) {
            if (!entry.name.startsWith(rootPrefix)) continue;
            let relative = entry.name.slice(rootPrefix.length);
            if (!relative || relative.startsWith(".git/") || relative === ".git") continue;

            if (selectedFolder) {
                if (!relative.startsWith(`${selectedFolder}/`)) continue;
                relative = relative.slice(selectedFolder.length + 1);
            }

            if (!relative || relative.split("/").some(part => part === "..")) continue;

            // Ignore repository metadata/documentation, not website runtime assets.
            const basename = relative.split("/").pop().toLowerCase();
            if (
                basename === "readme.md" ||
                basename === "readme.txt" ||
                basename === "license" ||
                basename.startsWith("license.") ||
                basename === ".gitignore" ||
                basename === ".gitattributes" ||
                basename === "package.json" ||
                basename === "package-lock.json" ||
                basename === "pnpm-lock.yaml" ||
                basename === "yarn.lock" ||
                basename === "tsconfig.json" ||
                basename === "vite.config.js" ||
                basename === "vite.config.ts"
            ) continue;

            candidates.push({ entry, relative });
        }

        if (!candidates.some(item => item.relative === "index.html")) {
            if (selectedFolder) {
                throw new Error(`No index.html was found inside the selected GitHub folder "${selectedFolder}". For React/Vite, choose the built dist folder.`);
            }
            // If root doesn't have index.html, infer a single nested website folder.
            const firstSegments = [...new Set(candidates.map(item => item.relative.split("/")[0]))];
            const nestedRoot = firstSegments.length === 1 ? firstSegments[0] : "";
            if (nestedRoot && candidates.some(item => item.relative === `${nestedRoot}/index.html`)) {
                for (const item of candidates) {
                    if (item.relative.startsWith(`${nestedRoot}/`)) {
                        item.relative = item.relative.slice(nestedRoot.length + 1);
                    } else {
                        item.relative = "";
                    }
                }
            }
        }

        if (!candidates.some(item => item.relative === "index.html")) {
            throw new Error("No static index.html found. For React/Vite repositories, build the project and import the dist folder; VignaDigital does not run npm install/build during import.");
        }

        const publishFiles = [];
        let totalBytes = 0;
        for (const item of candidates) {
            if (!item.relative) continue;
            const safePath = safeWebsitePath(item.relative);
            if (!safePath) throw new Error(`Unsafe path in GitHub archive: ${item.relative}`);
            if (!isAllowedWebsiteFile(safePath)) {
                // Ignore non-web source/docs files; don't publish them as website assets.
                continue;
            }
            const buffer = await item.entry.async("nodebuffer");
            totalBytes += buffer.length;
            if (totalBytes > MAX_UNZIPPED_BYTES) throw new Error("Uncompressed website exceeds the 25 MB limit.");
            publishFiles.push({ path: safePath, buffer });
        }

        if (!publishFiles.some(file => file.path === "index.html")) {
            throw new Error("The selected GitHub folder does not contain a publishable index.html.");
        }

        // Remove old published files recursively before replacing the website.
        async function removeStorageFolder(folderPath) {
            const { data: listed, error: listError } = await supabase.storage
                .from(SITE_BUCKET).list(folderPath, { limit: 100 });
            if (listError) throw new Error(`Could not inspect existing website files: ${listError.message}`);
            for (const item of listed || []) {
                const childPath = `${folderPath}/${item.name}`;
                if (item.id === null) {
                    await removeStorageFolder(childPath);
                } else {
                    const { error: removeError } = await supabase.storage.from(SITE_BUCKET).remove([childPath]);
                    if (removeError) throw new Error(`Could not remove old website file: ${removeError.message}`);
                }
            }
        }
        await removeStorageFolder(slug);

        for (const file of publishFiles) {
            const destination = `${slug}/${file.path}`;
            const { error: uploadError } = await supabase.storage.from(SITE_BUCKET).upload(destination, file.buffer, {
                contentType: require("mime-types").lookup(file.path) || "application/octet-stream",
                upsert: true,
                cacheControl: "3600"
            });
            if (uploadError) throw new Error(`Failed to publish ${file.path}: ${uploadError.message}`);
        }

        const { error: updateError } = await supabase.from("restaurants").update({
            website_status: "published",
            website_path: `${slug}/index.html`,
            updated_at: new Date().toISOString()
        }).eq("slug", slug);
        if (updateError) throw new Error(`Website files uploaded but database update failed: ${updateError.message}`);

        return res.json({
            success: true,
            message: "GitHub website imported and published successfully.",
            url: `/${slug}`,
            filesPublished: publishFiles.length
        });
    } catch (error) {
        console.error("GitHub website import failed:", error.message);
        await supabase.from("restaurants").update({
            website_status: "failed",
            updated_at: new Date().toISOString()
        }).eq("slug", slug);
        return res.status(500).json({
            success: false,
            message: error.message || "GitHub website import failed."
        });
    }
});

// ========================================
// CUSTOMER ORDERS + RESTAURANT NOTIFICATIONS
// Required table SQL is provided in orders-schema.sql.
// Email notifications use Resend when RESEND_API_KEY and ORDER_FROM_EMAIL are set.
// SMS notifications use Twilio when all TWILIO_* variables are set.
// ========================================
app.post("/api/restaurants/:slug/orders", async (req, res) => {
    try {
        const slug = createRestaurantSlug(req.params.slug);
        if (!slug) return res.status(400).json({ message: "Invalid restaurant URL." });
        const { customerName, customerPhone, customerEmail, orderType, tableNumber, roomNumber, deliveryAddress, deliveryCity, deliveryPincode, notes, items } = req.body || {};
        const normalizedType = String(orderType || "Takeaway").trim();
        const allowedTypes = ["Dine In", "Room Service", "Delivery", "Takeaway"];
        if (!allowedTypes.includes(normalizedType)) return res.status(400).json({ message: "Choose a valid order type." });
        if (normalizedType === "Dine In" && !String(tableNumber || "").trim()) return res.status(400).json({ message: "Table number is required for dine-in orders." });
        if (normalizedType === "Room Service" && !String(roomNumber || "").trim()) return res.status(400).json({ message: "Room number is required for room-service orders." });
        if (normalizedType === "Delivery" && (!String(deliveryAddress || "").trim() || !String(deliveryCity || "").trim() || !String(deliveryPincode || "").trim())) return res.status(400).json({ message: "Address, city and PIN code are required for delivery." });
        if (!String(customerName || "").trim() || !String(customerPhone || "").trim()) {
            return res.status(400).json({ message: "Customer name and mobile number are required." });
        }
        if (!/^[0-9+() .-]{7,20}$/.test(String(customerPhone).trim())) {
            return res.status(400).json({ message: "Enter a valid customer mobile number." });
        }
        if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customerEmail).trim())) {
            return res.status(400).json({ message: "Enter a valid customer email address." });
        }
        if (!Array.isArray(items) || !items.length || items.length > 50) {
            return res.status(400).json({ message: "Add at least one menu item to your order." });
        }
        const { data: restaurant, error: restaurantError } = await supabase
            .from("restaurants")
            .select("id, restaurant_name, slug, mobile, email, website_status")
            .eq("slug", slug).maybeSingle();
        if (restaurantError || !restaurant) return res.status(404).json({ message: "Restaurant not found for this menu URL." });
        if (restaurant.website_status !== "published" && slug !== "new-desi-tadka") {
            return res.status(400).json({ message: "This restaurant is not accepting online orders yet." });
        }
        // Read current menu prices from the database; never trust client-submitted prices.
      // Retrieve menu items and log the real database error if the query fails.
const {
    data: menuRows,
    error: menuError
} = await supabase
    .from("menu_items")
    .select("*");

if (menuError) {
    console.error(
        "Menu price verification failed:",
        menuError.code,
        menuError.message,
        menuError.details,
        menuError.hint
    );

    return res.status(500).json({
        message: "Could not verify current menu prices.",
        error: menuError.message,
        code: menuError.code
    });
}

if (!menuRows || menuRows.length === 0) {
    return res.status(400).json({
        message: "No menu items were found in the database."
    });
}
        const requested = [];
        for (const item of items) {
            const name = String(item?.name || "").trim();
            const quantity = Number(item?.quantity);
            if (!name || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
                return res.status(400).json({ message: "One of the requested items or quantities is invalid." });
            }
            const menuItem = (menuRows || []).find(row => String(row.name || row.title || "").trim() === name);
            if (!menuItem || !Number.isFinite(Number(menuItem.price)) || Number(menuItem.price) < 0) {
                return res.status(400).json({ message: `${name} is no longer available. Refresh the menu and try again.` });
            }
            requested.push({ name, quantity, unitPrice: Number(menuItem.price), lineTotal: Number(menuItem.price) * quantity });
        }
        const subtotal = Math.round(requested.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
        const taxRate = 0.05;
        const tax = Math.round(subtotal * taxRate * 100) / 100;
        const total = Math.round((subtotal + tax) * 100) / 100;
        const orderNumber = `NDT-${Date.now().toString().slice(-8)}`;
        const orderRecord = {
            restaurant_id: restaurant.id,
            restaurant_slug: slug,
            order_number: orderNumber,
            customer_name: String(customerName).trim().slice(0, 100),
            customer_phone: String(customerPhone).trim().slice(0, 20),
            customer_email: customerEmail ? String(customerEmail).trim().slice(0, 254) : null,
            order_type: normalizedType,
            table_number: normalizedType === "Dine In" ? String(tableNumber).trim().slice(0, 30) : null,
            room_number: normalizedType === "Room Service" ? String(roomNumber).trim().slice(0, 30) : null,
            delivery_address: normalizedType === "Delivery" ? [deliveryAddress, deliveryCity, deliveryPincode].map(v => String(v || "").trim()).filter(Boolean).join(", ").slice(0, 500) : null,
            delivery_city: normalizedType === "Delivery" ? String(deliveryCity).trim().slice(0, 100) : null,
            delivery_pincode: normalizedType === "Delivery" ? String(deliveryPincode).trim().slice(0, 12) : null,
            subtotal_amount: subtotal,
            tax_amount: tax,
            tax_rate: taxRate,
            notes: notes ? String(notes).trim().slice(0, 500) : null,
            items: requested,
            total_amount: total,
            status: "new"
        };
        const { data: savedOrder, error: saveError } = await supabase.from("restaurant_orders").insert(orderRecord).select("id,order_number,total_amount").single();
        if (saveError) {
            console.error("Order database insert failed:", saveError.message);
            if (saveError.code === "42P01") return res.status(500).json({ message: "Orders table is not configured yet. Run orders-schema.sql in Supabase SQL Editor." });
            throw new Error("Could not save your order. Please try again.");
        }
        const money = value => `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
        const lines = requested.map(item => `${item.quantity} × ${item.name} — ${money(item.lineTotal)}`).join("\n");
        const locationLine = normalizedType === "Dine In" ? `Table: ${orderRecord.table_number}` : normalizedType === "Room Service" ? `Room: ${orderRecord.room_number}` : normalizedType === "Delivery" ? `Delivery address: ${orderRecord.delivery_address}` : "Takeaway";
        const message = `New order ${orderNumber}\nRestaurant: ${restaurant.restaurant_name}\nOrder type: ${normalizedType}\n${locationLine}\n\n${lines}\n\nSubtotal: ${money(subtotal)}\nTax (5%): ${money(tax)}\nTotal: ${money(total)}\nCustomer: ${orderRecord.customer_name}\nPhone: ${orderRecord.customer_phone}\nEmail: ${orderRecord.customer_email || "Not provided"}\nNotes: ${orderRecord.notes || "None"}`;
        let notificationSent = false;
        const notificationErrors = [];
        // Send email through Resend if configured.
        if (restaurant.email && process.env.RESEND_API_KEY && process.env.ORDER_FROM_EMAIL) {
            try {
                const emailResponse = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ from: process.env.ORDER_FROM_EMAIL, to: [restaurant.email], subject: `New order ${orderNumber} — ${restaurant.restaurant_name}`, text: message })
                });
                if (emailResponse.ok) notificationSent = true;
                else notificationErrors.push(`Email provider returned ${emailResponse.status}`);
            } catch (err) { notificationErrors.push("Email delivery failed"); console.error("Order email error:", err.message); }
        }
        // Send SMS using Twilio only when the restaurant phone and credentials are configured.
        if (restaurant.mobile && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
            try {
                const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
                const body = new URLSearchParams({ To: restaurant.mobile.startsWith("+") ? restaurant.mobile : `+91${restaurant.mobile}`, From: process.env.TWILIO_FROM_NUMBER, Body: message.slice(0, 1500) });
                const smsResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, { method: "POST", headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
                if (smsResponse.ok) notificationSent = true;
                else notificationErrors.push(`SMS provider returned ${smsResponse.status}`);
            } catch (err) { notificationErrors.push("SMS delivery failed"); console.error("Order SMS error:", err.message); }
        }
        // Return a WhatsApp link as a useful fallback; user must tap it to send from their device.
        const digits = String(restaurant.mobile || "").replace(/\D/g, "");
        const whatsappUrl = digits ? `https://wa.me/${digits.startsWith("91") ? digits : `91${digits}`}?text=${encodeURIComponent(message)}` : null;
        return res.status(201).json({ success: true, orderId: savedOrder.id, orderNumber: savedOrder.order_number, subtotal, tax, total: savedOrder.total_amount, orderType: normalizedType, createdAt: new Date().toISOString(), notificationSent, whatsappUrl, message: notificationSent ? "Order received and restaurant notified." : "Order received. Restaurant notification is not configured; use the WhatsApp link to send it." });
    } catch (error) {
        console.error("Order submission failed:", error.message);
        return res.status(500).json({ message: error.message || "Unable to submit order." });
    }
});

// Serve published websites at /restaurant-slug and /restaurant-slug/assets/...
async function serveRestaurantWebsite(req, res, next) {
    try {
        const slug = createRestaurantSlug(req.params.slug);
        if (!slug || ["api", "admin", "onboard-restaurant", "images", "videos", "favicon.ico"].includes(slug)) return next();
        const { data: restaurant, error } = await supabase.from("restaurants")
            .select("slug, website_status").eq("slug", slug).maybeSingle();
        if (error || !restaurant || restaurant.website_status !== "published") return next();
        let relative = req.params.filePath || "index.html";
        // Express 5 wildcard parameters may be arrays of path segments.
        if (Array.isArray(relative)) relative = relative.join("/");
        relative = decodeURIComponent(String(relative));
        if (relative === "" || relative === "/") relative = "index.html";
        const safePath = safeWebsitePath(relative);
        if (!safePath || !isAllowedWebsiteFile(safePath)) return res.status(404).send("File not found");
        const { data: file, error: fileError } = await supabase.storage.from(SITE_BUCKET).download(`${slug}/${safePath}`);
        if (fileError || !file) return res.status(404).send("Website file not found");
        const mime = require("mime-types");

        const contentType =
            mime.lookup(safePath) || "application/octet-stream";

        res.setHeader("Content-Type", contentType);
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "no-cache");

        const buffer = Buffer.from(await file.arrayBuffer());

        return res.status(200).send(buffer);
    } catch (error) {
        console.error("Website serving error:", error.message);
        return res.status(500).send("Unable to load this restaurant website.");
    }
}
app.get("/:slug", (req, res, next) => { req.params.filePath = "index.html"; return serveRestaurantWebsite(req, res, next); });
app.get("/:slug/*filePath", serveRestaurantWebsite);

// ========================================
// ADD MENU ITEM
// ========================================

app.post(
    "/api/menu",
    requireAdmin,
    async (req, res) => {

        try {

            const {
                name,
                category,
                price,
                description,
                image
            } = req.body;


            if (
                !name ||
                !category ||
                price === undefined
            ) {

                return res.status(400).json({
                    message:
                        "Name, category and price are required"
                });

            }


            const newProduct = {

                id:
                    Date.now().toString(),

                name:
                    String(name).trim(),

                category:
                    String(category).trim(),

                price:
                    Number(price),

                description:
                    description
                        ? String(
                            description
                        ).trim()
                        : "",

                image:
                    image
                        ? String(
                            image
                        ).trim()
                        : null

            };


            if (
                Number.isNaN(
                    newProduct.price
                )
            ) {

                return res.status(400).json({
                    message:
                        "Price must be a valid number"
                });

            }


            const {
                data,
                error
            } =
                await supabase
                    .from(
                        "menu_items"
                    )
                    .insert([
                        newProduct
                    ])
                    .select()
                    .single();


            if (error) {

                console.error(
                    "Supabase INSERT error:",
                    error
                );


                return res.status(500).json({
                    message:
                        "Failed to add product"
                });

            }


            res.status(201).json({

                message:
                    "Product added successfully",

                product:
                    data

            });


        } catch (error) {

            console.error(error);


            res.status(500).json({
                message:
                    "Server error"
            });

        }

    }
);


// ========================================
// UPDATE MENU ITEM
// ========================================

app.put(
    "/api/menu/:id",
    requireAdmin,
    async (req, res) => {

        try {

            const {
                name,
                category,
                price,
                description,
                image
            } = req.body;


            if (
                !name ||
                !category ||
                price === undefined
            ) {

                return res.status(400).json({
                    message:
                        "Name, category and price are required"
                });

            }


            const updatedProduct = {

                name:
                    String(name).trim(),

                category:
                    String(category).trim(),

                price:
                    Number(price),

                description:
                    description
                        ? String(
                            description
                        ).trim()
                        : "",

                image:
                    image
                        ? String(
                            image
                        ).trim()
                        : null

            };


            if (
                Number.isNaN(
                    updatedProduct.price
                )
            ) {

                return res.status(400).json({
                    message:
                        "Price must be a valid number"
                });

            }


            const {
                data,
                error
            } =
                await supabase
                    .from(
                        "menu_items"
                    )
                    .update(
                        updatedProduct
                    )
                    .eq(
                        "id",
                        String(
                            req.params.id
                        )
                    )
                    .select()
                    .single();


            if (error) {

                console.error(
                    "Supabase UPDATE error:",
                    error
                );


                return res.status(500).json({
                    message:
                        "Failed to update product"
                });

            }


            res.json({

                message:
                    "Product updated successfully",

                product:
                    data

            });


        } catch (error) {

            console.error(error);


            res.status(500).json({
                message:
                    "Server error"
            });

        }

    }
);

// ========================================
// DELETE MENU ITEM
// ========================================

app.delete(
    "/api/menu/:id",
    requireAdmin,
    async (req, res) => {

        try {

            const id =
                String(
                    req.params.id
                );


            const {
                data,
                error
            } =
                await supabase
                    .from(
                        "menu_items"
                    )
                    .delete()
                    .eq(
                        "id",
                        id
                    )
                    .select()
                    .single();


            if (error) {

                console.error(
                    "Supabase DELETE error:",
                    error
                );


                return res.status(404).json({
                    message:
                        "Product not found"
                });

            }


            res.json({

                message:
                    "Product deleted successfully",

                product:
                    data

            });


        } catch (error) {

            console.error(error);


            res.status(500).json({
                message:
                    "Server error"
            });

        }

    }
);
// ========================================
// ONBOARD RESTAURANT PAGE
// ========================================

app.get(
    "/onboard-restaurant",
    requireAdmin,
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "../admin-pages/onboard-restaurant.html"
            )
        );
    }
);

// ========================================
// HTML PAGE ROUTES
// ========================================

app.get(
    "/admin",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "../public/admin.html"
            )
        );

    }
);


app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "../public/index.html"
            )
        );

    }
);


// ========================================
// AI MENU GENERATION + AUTHORIZED ORDER LIST
// Requires OPENAI_API_KEY in server environment.
// ========================================
app.post("/api/ai/generate-menu", requireAdmin, async (req, res) => {
    try {
        if (!process.env.OPENAI_API_KEY) return res.status(503).json({ message: "AI menu generation is not configured. Add OPENAI_API_KEY to the server environment." });
        const cuisine = String(req.body?.cuisine || "Indian").trim().slice(0, 80);
        const restaurantName = String(req.body?.restaurantName || "New Desi Tadka").trim().slice(0, 100);
        const categories = Array.isArray(req.body?.categories) ? req.body.categories.map(v => String(v).trim().slice(0, 60)).filter(Boolean).slice(0, 12) : ["Starters", "Main Course", "Desserts", "Beverages"];
        const count = Math.max(1, Math.min(30, Number.parseInt(req.body?.count, 10) || 10));
        const priceMin = Math.max(0, Number(req.body?.priceMin) || 0);
        const priceMax = Math.max(priceMin, Number(req.body?.priceMax) || 1000);
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
                temperature: 0.7,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: "Return valid JSON only in the form {\"items\":[{\"name\":string,\"category\":string,\"description\":string,\"price\":number,\"image\":string|null,\"available\":boolean}]}. Generate realistic menu ideas. Do not invent image URLs; use null for image." },
                    { role: "user", content: `Create ${count} menu items for ${restaurantName}. Cuisine: ${cuisine}. Use only these categories: ${categories.join(", ")}. Prices in INR between ${priceMin} and ${priceMax}. Include concise descriptions and set available=true.` }
                ]
            })
        });
        const payload = await response.json();
        if (!response.ok) {
            console.error("AI menu provider error:", payload?.error?.message || response.status);
            return res.status(502).json({ message: "AI menu provider request failed. Check the API key, model and provider limits." });
        }
        let parsed;
        try { parsed = JSON.parse(payload.choices?.[0]?.message?.content || "{}"); }
        catch { return res.status(502).json({ message: "AI returned an invalid menu format. Please try again." }); }
        const items = (Array.isArray(parsed.items) ? parsed.items : []).slice(0, count).map(item => ({
            name: String(item.name || "").trim().slice(0, 120),
            category: String(item.category || categories[0] || "Main Course").trim().slice(0, 60),
            description: String(item.description || "").trim().slice(0, 500),
            price: Math.round(Number(item.price) * 100) / 100,
            image: null,
            available: item.available !== false
        })).filter(item => item.name && Number.isFinite(item.price) && item.price >= 0);
        if (!items.length) return res.status(502).json({ message: "AI did not return usable menu items. Please try again." });
        return res.json({ items });
    } catch (error) {
        console.error("AI menu generation failed:", error.message);
        return res.status(500).json({ message: "Unable to generate menu items right now." });
    }
});


// Public, privacy-safe order status endpoint used by the customer's menu page.
app.get("/api/orders/:id/status", async (req, res) => {
    try {
        const orderId = String(req.params.id || "");
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
            return res.status(400).json({ message: "Invalid order ID." });
        }
        const { data, error } = await supabase
            .from("restaurant_orders")
            .select("id,order_number,status")
            .eq("id", orderId)
            .maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ message: "Order not found." });
        res.setHeader("Cache-Control", "no-store");
        return res.json({ orderId: data.id, orderNumber: data.order_number, status: data.status || "new" });
    } catch (error) {
        console.error("Order status lookup failed:", error.message);
        return res.status(500).json({ message: "Could not check order status." });
    }
});

// Restaurant owner updates order progress from the admin page.
// Keep Supabase's existing allowed statuses: new, accepted, preparing, completed, cancelled.
app.patch("/api/admin/orders/:id/status", requireAdmin, async (req, res) => {
    try {
        const orderId = String(req.params.id || "");
        const requestedStatus = String(req.body?.status || "").trim().toLowerCase();

        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
            return res.status(400).json({ message: "Invalid order ID." });
        }

        // UI labels map to the values already allowed by restaurant_orders_status_check.
        const statusMap = {
            active: "preparing",
            prepared: "completed"
        };
        const status = statusMap[requestedStatus];

        if (!status) {
            return res.status(400).json({ message: "Status must be Active or Prepared." });
        }

        const { data, error } = await supabase
            .from("restaurant_orders")
            .update({ status })
            .eq("id", orderId)
            .select("id,order_number,status")
            .single();

        if (error) {
            console.error("Supabase order status update error:", error.code, error.message, error.details);
            throw error;
        }

        return res.json({ success: true, order: data });
    } catch (error) {
        console.error("Order status update failed:", error.message);
        return res.status(500).json({ message: "Could not update order status." });
    }
});

app.get("/api/admin/orders", requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase.from("restaurant_orders").select("id,order_number,restaurant_slug,customer_name,customer_phone,customer_email,order_type,table_number,room_number,delivery_address,delivery_city,delivery_pincode,items,subtotal_amount,tax_amount,total_amount,status,notes,created_at").order("created_at", { ascending: false }).limit(100);
        if (error) {
            if (error.code === "42703") return res.status(500).json({ message: "Run the provided orders-schema.sql migration first." });
            throw error;
        }
        res.json({ orders: data || [] });
    } catch (error) {
        console.error("Admin orders load failed:", error.message);
        res.status(500).json({ message: "Could not load orders." });
    }
});

app.get("/api/admin/orders", requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("restaurant_orders")
            .select("id,order_number,restaurant_slug,customer_name,customer_phone,customer_email,order_type,table_number,room_number,delivery_address,delivery_city,delivery_pincode,items,subtotal_amount,tax_amount,total_amount,status,notes,created_at")
            .order("created_at", { ascending: false })
            .limit(100);

        if (error) {
            if (error.code === "42703") {
                return res.status(500).json({
                    message: "Run the provided orders-schema.sql migration first."
                });
            }
            throw error;
        }

        res.setHeader("Cache-Control", "no-store");
        res.json({ orders: data || [] });

    } catch (error) {
        console.error("Admin orders load failed:", error);
        console.error("Underlying cause:", error.cause || "No additional cause provided");

        res.status(500).json({
            message: "Could not load orders."
        });
    }
});


// Admin: export all past orders (used by the admin PDF export button).
app.get("/api/admin/orders/export", requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("restaurant_orders")
            .select("id,order_number,restaurant_slug,customer_name,customer_phone,customer_email,order_type,table_number,room_number,delivery_address,delivery_city,delivery_pincode,items,subtotal_amount,tax_amount,total_amount,status,notes,created_at")
            .order("created_at", { ascending: false });
        if (error) throw error;
        res.setHeader("Cache-Control", "no-store");
        res.json({ orders: data || [] });
    } catch (error) {
        console.error("Admin order export failed:", error);
        res.status(500).json({ message: "Could not export past orders." });
    }
});

// Admin: permanently delete specifically selected orders.
app.post("/api/admin/orders/delete-selected", requireAdmin, async (req, res) => {
    try {
        const ids = Array.isArray(req.body?.ids) ? [...new Set(req.body.ids.map(id => String(id)))] : [];
        if (!ids.length) return res.status(400).json({ message: "Select at least one order to delete." });
        if (ids.length > 100) return res.status(400).json({ message: "You can delete up to 100 orders at a time." });
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (ids.some(id => !uuidPattern.test(id))) return res.status(400).json({ message: "One or more selected order IDs are invalid." });

        const { data, error } = await supabase
            .from("restaurant_orders")
            .delete()
            .in("id", ids)
            .select("id");
        if (error) throw error;
        res.setHeader("Cache-Control", "no-store");
        return res.json({ success: true, deleted: (data || []).length });
    } catch (error) {
        console.error("Selected-order deletion failed:", error);
        return res.status(500).json({ message: "Could not delete selected orders." });
    }
});

// Admin: permanently delete orders older than 15 days.
app.post("/api/admin/orders/delete-expired", requireAdmin, async (req, res) => {
    try {
        const cutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();

        // Count eligible rows first so the admin can see the result.
        const { count, error: countError } = await supabase
            .from("restaurant_orders")
            .select("id", { count: "exact", head: true })
            .lt("created_at", cutoff);
        if (countError) throw countError;

        const { error: deleteError } = await supabase
            .from("restaurant_orders")
            .delete()
            .lt("created_at", cutoff);
        if (deleteError) throw deleteError;

        res.setHeader("Cache-Control", "no-store");
        res.json({ success: true, deleted: count || 0, cutoff });
    } catch (error) {
        console.error("Admin expired-order deletion failed:", error);
        res.status(500).json({ message: "Could not delete expired orders." });
    }
});

// ========================================
// START SERVER
// ========================================

if (require.main === module) {
    app.listen(PORT, "0.0.0.0", () => {
        console.log("=================================");
        console.log(" VignaDigital Server Started");
        console.log("=================================");
        console.log(` Local URL: http://localhost:${PORT}`);
        console.log(` Admin Panel: http://localhost:${PORT}/admin`);
        console.log(` Onboard Restaurant: http://localhost:${PORT}/onboard-restaurant`);
        console.log("=================================");
    });
}

module.exports = app;