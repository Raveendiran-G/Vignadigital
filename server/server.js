require("dotenv").config();


const express = require("express");
const path = require("path");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");

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