const express = require("express");
const path = require("path");
const multer = require("multer");
const mammoth = require("mammoth");
const nodemailer = require("nodemailer");
const { Document, Packer, Paragraph } = require("docx");

const app = express();

// Serve static files (index.html) from /public
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Multer (memory storage so it works fine on Vercel/serverless too)
const upload = multer({ storage: multer.memoryStorage() });

// ---- Helpers ----
const extractVariables = (content) => {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        const varName = match[1].trim();
        if (!matches.includes(varName)) matches.push(varName);
    }
    return matches;
};

const replaceVariablesWithPadding = (originalContent, variables, values) => {
    let processedContent = originalContent;

    variables.forEach((varName) => {
        const value = (values[varName] || "").toString();
        let replacement = value;

        if (value.length < varName.length) {
            const underscoresNeeded = varName.length - value.length;
            const left = Math.floor(underscoresNeeded / 2);
            const extra = underscoresNeeded % 2;
            replacement = "_".repeat(left + extra) + value + "_".repeat(left);
        }

        const regex = new RegExp(`\\{\\{\\s*${varName}\\s*\\}\\}`, "g");
        processedContent = processedContent.replace(regex, replacement);
    });

    return processedContent;
};

const getTextFromUpload = async (file) => {
    const name = file.originalname.toLowerCase();
    if (name.endsWith(".docx")) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        return result.value || "";
    } else if (name.endsWith(".txt") || name.endsWith(".doc")) {
        // NOTE: .doc here is treated as plain text; true .doc binary isn't parsed.
        return file.buffer.toString("utf-8");
    } else {
        throw new Error("Unsupported file type. Please upload .doc, .docx, or .txt");
    }
};

const buildAttachmentFromProcessed = async (processedContent, originalName) => {
    const base = path.basename(originalName).replace(/\.[^/.]+$/, "");
    const ext = originalName.split(".").pop().toLowerCase();

    if (ext === "txt" || ext === "doc") {
        const filename = `processed_${base}.txt`;
        return {
            filename,
            content: Buffer.from(processedContent, "utf-8"),
            contentType: "text/plain",
        };
    } else {
        const doc = new Document({
            sections: [
                {
                    properties: {},
                    children: processedContent.split("\n").map((line) => new Paragraph(line)),
                },
            ],
        });
        const buffer = await Packer.toBuffer(doc);
        const filename = `processed_${base}.docx`;
        return {
            filename,
            content: buffer,
            contentType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        };
    }
};

// ---- API: Inspect (find variables) ----
app.post("/api/inspect", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const text = await getTextFromUpload(req.file);
        const variables = extractVariables(text);
        res.json({ variables });
    } catch (err) {
        console.error("INSPECT ERROR:", err);
        res.status(400).json({ error: err.message || "Inspect failed" });
    }
});

// ---- API: Send (process + email) ----
app.post("/api/send", upload.single("file"), async (req, res) => {
    try {
        const toEmail = req.body.email;
        if (!toEmail) return res.status(400).json({ error: "Recipient email is required" });
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        // values come as JSON string
        let values = {};
        if (req.body.values) {
            try {
                values = JSON.parse(req.body.values);
            } catch {
                return res.status(400).json({ error: "Invalid values JSON" });
            }
        }

        // Get text and variables from file
        const originalText = await getTextFromUpload(req.file);
        const variables = extractVariables(originalText);

        // Process replacements with underscore padding
        const processedContent = replaceVariablesWithPadding(originalText, variables, values);

        // Build the attachment (txt or docx)
        const attachment = await buildAttachmentFromProcessed(
            processedContent,
            req.file.originalname
        );

        // Nodemailer transporter (use your SMTP creds via env vars)
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,        // e.g. "smtp.gmail.com"
            port: Number(process.env.SMTP_PORT) || 465,
            secure: process.env.SMTP_SECURE !== "false", // true for 465, false for 587
            auth: {
                user: process.env.SMTP_USER,      // your SMTP user / email
                pass: process.env.SMTP_PASS       // your SMTP password or app password
            }
        });

        const info = await transporter.sendMail({
            from: process.env.FROM_EMAIL || process.env.SMTP_USER,
            to: toEmail,
            subject: "Processed Document",
            text: "Hello,\n\nPlease find the processed document attached.\n",
            attachments: [attachment],
        });

        res.json({ ok: true, messageId: info.messageId });
    } catch (err) {
        console.error("SEND ERROR:", err);
        res.status(500).json({ error: err.message || "Send failed" });
    }
});

// Local dev
const port = process.env.PORT || 3000;
if (process.env.VERCEL !== "1") {
    app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
    });
}

module.exports = app; // for Vercel
