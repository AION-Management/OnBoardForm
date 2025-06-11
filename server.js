// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const app = express();

// SharePoint configuration
const SHAREPOINT_CONFIG = {
    site: process.env.SHAREPOINT_SITE,
    driveId: process.env.SHAREPOINT_DRIVE_ID,
    folder: process.env.SHAREPOINT_FOLDER,
    clientId: process.env.SHAREPOINT_CLIENT_ID,
    clientSecret: process.env.SHAREPOINT_CLIENT_SECRET,
    tenantId: process.env.SHAREPOINT_TENANT_ID
};

// Function to get Microsoft Graph API access token
async function getAccessToken() {
    try {
        const tokenUrl = `https://login.microsoftonline.com/${SHAREPOINT_CONFIG.tenantId}/oauth2/v2.0/token`;
        const tokenData = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: SHAREPOINT_CONFIG.clientId,
            client_secret: SHAREPOINT_CONFIG.clientSecret,
            scope: 'https://graph.microsoft.com/.default'
        });

        const response = await axios.post(tokenUrl, tokenData);
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting access token:', error);
        throw error;
    }
}

// Function to get site ID
async function getSiteId(accessToken) {
    try {
        const siteUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_CONFIG.site}:/sites/AionCloud`;
        const response = await axios.get(siteUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        console.log('Site ID:', response.data.id);
        return response.data.id;
    } catch (error) {
        console.error('Error getting site ID:', error.response?.data || error.message);
        throw error;
    }
}

// Function to get drive ID
async function getDriveId(accessToken, siteId) {
    try {
        const drivesUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`;
        const response = await axios.get(drivesUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        console.log('Available drives:', response.data.value);
        
        // Find the Information Technology drive
        const itDrive = response.data.value.find(drive => drive.name === 'Information Technology');
        if (!itDrive) {
            throw new Error('Information Technology drive not found');
        }
        console.log('Found Information Technology drive:', itDrive);
        return itDrive.id;
    } catch (error) {
        console.error('Error getting drive ID:', error.response?.data || error.message);
        throw error;
    }
}

// Function to upload a file to SharePoint
async function uploadFileToSharePoint(filePath, folderName, accessToken) {
    try {
        const fileName = path.basename(filePath);
        // Get site ID and drive ID
        const siteId = await getSiteId(accessToken);
        const driveId = await getDriveId(accessToken, siteId);
        
        // URL encode the folder path components
        const encodedFolder = encodeURIComponent('Onboarding Form');  // Just use the subfolder name
        const encodedFolderName = encodeURIComponent(folderName);
        const encodedFileName = encodeURIComponent(fileName);
        
        const uploadUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/root:/${encodedFolder}/${encodedFolderName}/${encodedFileName}:/content`;
        
        console.log('Upload details:');
        console.log('- Drive ID:', driveId);
        console.log('- Base folder: Onboarding Form');
        console.log('- Subfolder:', folderName);
        console.log('- File:', fileName);
        console.log('- Full path:', `Onboarding Form/${folderName}/${fileName}`);
        console.log('Attempting to upload to URL:', uploadUrl);
        
        const fileStream = fs.createReadStream(filePath);
        const response = await axios.put(uploadUrl, fileStream, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/octet-stream'
            }
        });

        console.log(`Successfully uploaded ${fileName}`);
        return true;
    } catch (error) {
        console.error(`Failed to upload ${path.basename(filePath)}:`, error.response?.data || error.message);
        return false;
    }
}

// Function to upload a folder to SharePoint
async function uploadFolderToSharePoint(folderPath, folderName) {
    try {
        const accessToken = await getAccessToken();
        const files = fs.readdirSync(folderPath);
        let success = true;

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            if (fs.statSync(filePath).isFile()) {
                const fileSuccess = await uploadFileToSharePoint(filePath, folderName, accessToken);
                if (!fileSuccess) {
                    success = false;
                }
            }
        }

        return success;
    } catch (error) {
        console.error(`Error uploading folder ${folderName}:`, error);
        return false;
    }
}

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
const processedDir = path.join(__dirname, 'processed');
if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
}
if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir);
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

// Watch the processed directory for new folders
const watcher = chokidar.watch(processedDir, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    depth: 1
});

// Handle new folders in processed directory
watcher.on('addDir', async (dirPath) => {
    const folderName = path.basename(dirPath);
    console.log(`New folder detected: ${folderName}`);
    
    try {
        const success = await uploadFolderToSharePoint(dirPath, folderName);
        if (success) {
            console.log(`Successfully uploaded ${folderName} to SharePoint`);
        } else {
            console.error(`Failed to upload ${folderName} to SharePoint`);
        }
    } catch (error) {
        console.error(`Error processing folder ${folderName}:`, error);
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

        // Run the process_submissions script
        const { exec } = require('child_process');
        exec('./process_submissions.sh', (error, stdout, stderr) => {
            if (error) {
                console.error(`Error running process_submissions.sh: ${error}`);
            }
            if (stderr) {
                console.error(`process_submissions.sh stderr: ${stderr}`);
            }
            console.log(`process_submissions.sh stdout: ${stdout}`);
        });

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
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || '/etc/ssl/certs';
const DOMAIN = process.env.DOMAIN || 'onboarding.aiontechnology.org';

// Try to create HTTPS server if SSL certificates exist
try {
    const options = {
        key: fs.readFileSync(path.join(SSL_CERT_PATH, 'privkey.pem')),
        cert: fs.readFileSync(path.join(SSL_CERT_PATH, 'fullchain.pem'))
    };
    https.createServer(options, app).listen(PORT, () => {
        console.log(`HTTPS Server running on port ${PORT}`);
    });
} catch (error) {
    console.log('SSL certificates not found, falling back to HTTP');
    app.listen(PORT, () => {
        console.log(`HTTP Server running on port ${PORT}`);
    });
}
