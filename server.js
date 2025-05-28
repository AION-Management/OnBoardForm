// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const app = express();

// Trust proxy for HTTPS
app.set('trust proxy', 1);

// Add error handling for uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Don't exit the process
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process
});

// Enable CORS for all routes with specific options
app.use(cors({
    origin: 'https://onboarding.aiontechnology.org',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create results directory if it doesn't exist
const resultsDir = path.join(__dirname, 'results');
if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, resultsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10485760 // 10MB limit    
    }
});

// Basic route for testing
app.get('/', (req, res) => {
    res.json({ message: 'Server is working!' });
});

// Handle form submission
app.post('/results', upload.any(), (req, res) => {
    try {
        const formData = req.body;
        const files = req.files || [];

        // Create a unique subdirectory for this submission
        const timestamp = new Date().toLocaleDateString().replace(/[/:.]/g, '-');
        const propertyName = (formData.propertyName || 'unknown_property').replace(/[^a-zA-Z0-9_-]/g, '_');
        const submissionDir = path.join(resultsDir, `${propertyName}_${timestamp}`);
        fs.mkdirSync(submissionDir, { recursive: true });

        // Move uploaded files into the submission directory
        const fileInfos = [];
        for (const file of files) {
            // Sanitize the fieldname and originalname for filesystem safety
            const safeOriginalname = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
            const newFilename = `${safeOriginalname}`
            const newFilePath = path.join(submissionDir, newFilename);
            fs.renameSync(file.path, newFilePath);
            fileInfos.push({
                fieldname: file.fieldname,
                originalname: file.originalname,
                filename: newFilename,
                path: newFilePath
            });
        }

        // Save form data to a JSON file in the submission directory
        const jsonFilePath = path.join(submissionDir, 'submission.json');
        const dataToSave = {
            formData: formData,
            files: fileInfos
        };
        fs.writeFileSync(jsonFilePath, JSON.stringify(dataToSave, null, 2));

        res.json({
            success: true,
            message: 'Form submitted successfully',
            data: {
                propertyName: propertyName,
                timestamp: timestamp,
                filesReceived: files.length
            }
        });
    } catch (error) {
        console.error('Error processing form submission:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing form submission',
            error: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error',
        error: err.message 
    });
});

const PORT = process.env.PORT || 3001;

// SSL certificate options
const options = {
    key: fs.readFileSync('/etc/letsencrypt/live/onboarding.aiontechnology.org/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/onboarding.aiontechnology.org/fullchain.pem')
};

// Create HTTPS server
app.listen(PORT, () => {
    console.log(`HTTP Server running on port ${PORT}`);
});
