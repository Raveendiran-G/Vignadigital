require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// ================================
// SUPABASE
// ================================

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);

// ================================
// MENU FILE
// ================================

const MENU_FILE = path.join(
    __dirname,
    "server",
    "menu.json"
);

// ================================
// MAIN
// ================================

async function migrateMenu() {

    console.log("");
    console.log("================================");
    console.log(" New Desi Tadka Menu Migration");
    console.log("================================");
    console.log("");

    // Check environment variables

    if (!process.env.SUPABASE_URL) {

        console.error(
            "❌ SUPABASE_URL is missing from .env"
        );

        return;
    }

    if (!process.env.SUPABASE_SECRET_KEY) {

        console.error(
            "❌ SUPABASE_SECRET_KEY is missing from .env"
        );

        return;
    }

    // Read menu.json

    let menu;

    try {

        const data =
            fs.readFileSync(
                MENU_FILE,
                "utf8"
            );

        menu = JSON.parse(data);

    } catch (error) {

        console.error(
            "❌ Could not read server/menu.json"
        );

        console.error(error.message);

        return;
    }

    console.log(
        `Found ${menu.length} menu items.`
    );

    console.log("");

    // Make sure every item has an ID

    menu = menu.map(
        (item, index) => ({

            id:
                String(
                    item.id ??
                    index + 1
                ),

            name:
                String(
                    item.name ?? ""
                ).trim(),

            category:
                String(
                    item.category ?? ""
                ).trim(),

            price:
                Number(
                    item.price ?? 0
                ),

            description:
                String(
                    item.description ?? ""
                ).trim(),

            image:
                item.image
                    ? String(item.image).trim()
                    : null

        })
    );

    // Check for duplicate IDs

    const ids = menu.map(
        item => item.id
    );

    const duplicateIds =
        ids.filter(
            (id, index) =>
                ids.indexOf(id) !== index
        );

    if (duplicateIds.length > 0) {

        console.error(
            "❌ Duplicate IDs found:"
        );

        console.error(
            [...new Set(duplicateIds)]
        );

        return;
    }

    // ================================
    // UPLOAD
    // ================================

    console.log(
        "Uploading items to Supabase..."
    );

    const BATCH_SIZE = 50;

    let uploaded = 0;

    for (
        let i = 0;
        i < menu.length;
        i += BATCH_SIZE
    ) {

        const batch =
            menu.slice(
                i,
                i + BATCH_SIZE
            );

        const {
            error
        } = await supabase
            .from("menu_items")
            .upsert(
                batch,
                {
                    onConflict: "id"
                }
            );

        if (error) {

            console.error("");
            console.error(
                "❌ Upload failed"
            );

            console.error(
                error.message
            );

            return;
        }

        uploaded += batch.length;

        console.log(
            `✅ Uploaded ${uploaded}/${menu.length}`
        );
    }

    // ================================
    // VERIFY
    // ================================

    const {
        count,
        error: countError
    } = await supabase
        .from("menu_items")
        .select(
            "*",
            {
                count: "exact",
                head: true
            }
        );

    if (countError) {

        console.error(
            "Could not verify database."
        );

        console.error(
            countError.message
        );

        return;
    }

    console.log("");
    console.log(
        "================================"
    );
    console.log(" Migration complete!");
    console.log(
        ` Supabase items: ${count}`
    );
    console.log(
        "================================"
    );
    console.log("");
}

migrateMenu();