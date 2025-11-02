import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import 'dotenv/config';
import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import jwt from 'jsonwebtoken';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import fetch from 'node-fetch';
import FormData from 'form-data';

const app = express();
const PORT = 4000;
app.use(cors());
app.use(express.json());

// --- NCVET Course Data ---
const NCVET_COURSES = [
    "Certificate Course in Wood Carving", "Diploma Course in Furniture Design and Making", "Certificate Course in PLC Programming",
    "Diploma Course in Industrial Robotics", "Certificate Course in Mobile Phone Repair", "Diploma Course in Telecommunication Network Engineering",
    "Certificate Course in Internet of Things (IoT) Fundamentals", "Diploma Course in Cybersecurity for Telecom Networks",
    "Certificate Course in SCADA Systems", "Diploma Course in Process Automation",
];

// ================== DATABASE MODELS ==================
const certificateSchema = new mongoose.Schema({
    learnerName: String,
    studentId: { type: String, required: true },
    courseName: String,
    certificateId: { type: String, unique: true, required: true },
    transactionHash: String,
    ipfsCid: String,
    status: { type: String, enum: ['Issued', 'Revoked'], default: 'Issued' }
});
const Certificate = mongoose.model('Certificate', certificateSchema);

const studentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String },
    studentId: { type: String, unique: true, required: true },
    email: { type: String, unique: true, sparse: true },
    enrollments: [{
        courseName: { type: String, required: true },
        status: { type: String, enum: ['Enrolled', 'Certified', 'Revoked'], default: 'Enrolled' },
        certificateId: { type: String, default: null },
        ipfsCid: { type: String, default: null },
        transactionHash: { type: String, default: null },
    }]
});
const Student = mongoose.model('Student', studentSchema);

const institutionSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    walletAddress: { type: String, required: true, unique: true },
    isMinter: { type: Boolean, default: false }
});
const Institution = mongoose.model('Institution', institutionSchema);


// ================== CONNECTIONS & DATA SEEDING ==================
mongoose.connect(process.env.DATABASE_URL)
    .then(async () => {
        console.log('Successfully connected to MongoDB Atlas!');
        
        // Check if there are any students in the database
        const studentCount = await Student.countDocuments();
        
        // Only seed data if the database is empty
        if (studentCount === 0) {
            console.log('No students found. Seeding database with 50 sample students...');
            const sampleStudents = [];
            const names = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan", "Saanvi", "Aadhya", "Kiara", "Diya", "Pari", "Ananya", "Riya", "Aarohi", "Amaira", "Myra", "Kabir", "Rohan", "Advik", "Aarush", "Dhruv", "Zoya", "Ishita", "Navya", "Siya", "Prisha", "Aryan", "Atharv", "Shaurya", "Veer", "Dev", "Zara", "Avani", "Ishani", "Alia", "Tara", "Rudra", "Arnav", "Yash", "Kabir", "Samarth", "Anika", "Shanaya", "Eva", "Gia", "Ira"];
            
            for (let i = 0; i < 50; i++) {
                sampleStudents.push({
                    name: `${names[i]} ${i % 3 === 0 ? 'Sharma' : (i % 3 === 1 ? 'Verma' : 'Gupta')}`,
                    studentId: `${2001 + i}`,
                    phone: `98765432${10 + i}`,
                    email: `${names[i].toLowerCase()}.${i}@example.com`,
                    enrollments: [{
                        courseName: NCVET_COURSES[Math.floor(Math.random() * NCVET_COURSES.length)],
                        status: 'Enrolled'
                    }]
                });
            }
            await Student.insertMany(sampleStudents);
            console.log('50 sample students have been added.');
        } else {
            console.log('Database already contains data. Skipping seed process.');
        }
    })
    .catch(err => console.error('Error connecting to MongoDB:', err));

const provider = new ethers.JsonRpcProvider(process.env.NETWORK_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contractABI = JSON.parse(readFileSync('./artifacts/contracts/CertiChain.sol/CertiChain.json')).abi;
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, wallet);
console.log(`Connected to contract at address: ${process.env.CONTRACT_ADDRESS}`);

// ================== MIDDLEWARE & HELPERS ==================
const authMiddleware = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied.' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET).user;
        if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied. Admin role required.' });
        next();
    } catch (e) { res.status(400).json({ message: 'Token is not valid.' }); }
};

async function generateAndUploadCertificate(learnerName, courseName, certificateId) {
    const verificationUrl = `http://${process.env.VITE_FRONTEND_IP || 'localhost'}:5173/?id=${certificateId}`;
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([841.89, 595.28]);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    page.drawText('Certificate of Completion', { x: 50, y: height - 80, font: boldFont, size: 40, color: rgb(0.1, 0.3, 0.6) });
    page.drawText('This is to certify that', { x: 50, y: height - 150, font, size: 20, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(learnerName, { x: 50, y: height - 200, font: boldFont, size: 32, color: rgb(0, 0, 0) });
    page.drawText('has successfully completed the course:', { x: 50, y: height - 250, font, size: 20, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(courseName, { x: 50, y: height - 300, font: boldFont, size: 28, color: rgb(0.1, 0.1, 0.1) });
    page.drawText('Issued by NCVET', { x: 50, y: 100, font, size: 14 });
    page.drawText(`Certificate ID: ${certificateId}`, { x: 50, y: 80, font, size: 10, color: rgb(0.5, 0.5, 0.5) });
    const qrCodeImage = await QRCode.toDataURL(verificationUrl);
    const qrImageBytes = Buffer.from(qrCodeImage.split(',')[1], 'base64');
    const qrImage = await pdfDoc.embedPng(qrImageBytes);
    page.drawImage(qrImage, { x: width - 150, y: 80, width: 100, height: 100 });
    const pdfBytes = await pdfDoc.save();
    const formData = new FormData();
    formData.append('file', Buffer.from(pdfBytes), { filename: `${certificateId}.pdf` });
    const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: { pinata_api_key: process.env.PINATA_API_KEY, pinata_secret_api_key: process.env.PINATA_API_SECRET },
        body: formData,
    });
    const pinataData = await pinataResponse.json();
    if (!pinataResponse.ok) throw new Error(`Piñata API Error: ${pinataData.error ? pinataData.error.reason : 'Unknown error'}`);
    return pinataData.IpfsHash;
}

// ================== API ROUTES ==================

app.post('/api/auth/admin-login', async (req, res) => {
    try {
        const { adminId, password } = req.body;
        if (adminId === process.env.ADMIN_ID && password === process.env.ADMIN_PASSWORD) {
            const payload = { user: { id: 'admin', role: 'admin' } };
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5h' });
            res.json({ token });
        } else {
            return res.status(400).json({ message: 'Invalid Admin credentials.' });
        }
    } catch (error) { res.status(500).json({ message: 'Server error during admin login.' }); }
});

app.get('/api/admin/students', authMiddleware, async (req, res) => {
    try {
        const students = await Student.find({}).sort({ name: 1 });
        res.json(students);
    } catch (error) { res.status(500).json({ message: 'Server error fetching students' }); }
});

app.post('/api/issue', authMiddleware, async (req, res) => {
    try {
        const { studentId, courseName } = req.body;
        const student = await Student.findOne({ studentId });
        if (!student) return res.status(404).json({ message: 'Student not found.' });
        
        const enrollment = student.enrollments.find(e => e.courseName === courseName);
        if (!enrollment) return res.status(404).json({ message: 'Student is not enrolled in this course.' });
        if (enrollment.status === 'Certified') return res.status(400).json({ message: 'This enrollment is already certified.' });

        const certificateId = `CERT-${Date.now()}`;
        const certificateData = `${student.name}-${studentId}-${courseName}`;
        const certificateHash = ethers.keccak256(ethers.toUtf8Bytes(certificateData));
        
        const tx = await contract.issueCertificate(certificateHash);
        await tx.wait();
        
        const ipfsCid = await generateAndUploadCertificate(student.name, courseName, certificateId);
        
        const newCertificate = new Certificate({
            learnerName: student.name, studentId, courseName, certificateId,
            transactionHash: tx.hash, ipfsCid: ipfsCid, status: 'Issued',
        });
        await newCertificate.save();
        
        enrollment.status = 'Certified';
        enrollment.certificateId = certificateId;
        enrollment.ipfsCid = ipfsCid;
        enrollment.transactionHash = tx.hash;
        await student.save();
        
        res.status(200).json({
            message: `Certificate Issued Successfully!`,
            ipfsLink: `https://gateway.pinata.cloud/ipfs/${ipfsCid}`
        });
    } catch (error) {
        console.error('Error issuing certificate:', error);
        res.status(500).json({ message: 'Error issuing certificate.' });
    }
});

app.post('/api/admin/burn-certificate', authMiddleware, async (req, res) => {
    try {
        const { certificateId } = req.body;
        
        const certRecord = await Certificate.findOne({ certificateId });
        if (!certRecord) return res.status(404).json({ message: 'Certificate ID not found.' });
        if (certRecord.status === 'Revoked') return res.status(400).json({ message: 'Certificate has already been revoked.' });

        const certificateData = `${certRecord.learnerName}-${certRecord.studentId}-${certRecord.courseName}`;
        const certificateHash = ethers.keccak256(ethers.toUtf8Bytes(certificateData));
        
        const tx = await contract.burnCertificate(certificateHash);
        await tx.wait();
        
        certRecord.status = 'Revoked';
        await certRecord.save();
        
        const student = await Student.findOne({ studentId: certRecord.studentId });
        if (student) {
            const enrollment = student.enrollments.find(e => e.certificateId === certificateId);
            if (enrollment) {
                enrollment.status = 'Revoked';
                await student.save();
            }
        }
        res.status(200).json({ message: `Certificate ${certificateId} has been successfully revoked.` });
    } catch (error) {
        console.error("Burn certificate error:", error);
        res.status(500).json({ message: 'Error revoking certificate.' });
    }
});

app.post('/api/admin/enroll', authMiddleware, async(req, res) => {
    try {
        const { studentId, courseName } = req.body;
        const student = await Student.findOne({ studentId });
        if (!student) return res.status(404).json({ message: 'Student not found.'});

        const isEnrolled = student.enrollments.some(e => e.courseName === courseName);
        if (isEnrolled) return res.status(400).json({ message: 'Student is already enrolled in this course.'});

        student.enrollments.push({ courseName, status: 'Enrolled' });
        await student.save();
        res.status(200).json(student);
    } catch (error) {
        res.status(500).json({ message: 'Error enrolling student.' });
    }
});

app.get('/api/admin/institutions', authMiddleware, async (req, res) => {
    try {
        const institutions = await Institution.find({});
        res.json(institutions);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching institutions.' });
    }
});

app.post('/api/admin/institutions', authMiddleware, async (req, res) => {
    try {
        const { name, walletAddress } = req.body;
        if (!name || !walletAddress) return res.status(400).json({ message: 'Name and wallet address are required.' });
        if (!ethers.isAddress(walletAddress)) return res.status(400).json({ message: 'Invalid wallet address provided.' });

        const newInstitution = new Institution({ name, walletAddress });
        await newInstitution.save();
        res.status(201).json(newInstitution);
    } catch (error) {
        res.status(500).json({ message: 'Error adding institution. It may already exist.' });
    }
});

app.post('/api/admin/grant-role', authMiddleware, async (req, res) => {
    try {
        const { walletAddress } = req.body;
        const institution = await Institution.findOne({ walletAddress });
        if (!institution) return res.status(404).json({ message: 'Institution not found.' });
        
        const tx = await contract.grantMinterRole(walletAddress); 
        await tx.wait();
        
        institution.isMinter = true;
        await institution.save();
        res.status(200).json({ message: `Minter role granted to ${institution.name}.` });
    } catch (error) {
        console.error("Grant role error:", error);
        res.status(500).json({ message: 'Error granting minter role.' });
    }
});

app.post('/api/student/lookup', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email is required.' });
        const student = await Student.findOne({ email });
        if (!student) return res.status(404).json({ message: 'No student found with this email address.' });
        const certificates = await Certificate.find({ studentId: student.studentId, status: 'Issued' });
        res.json({ student, certificates });
    } catch (error) { res.status(500).json({ message: 'Server error during lookup.' }); }
});

app.post('/api/student/lookupById', async (req, res) => {
    try {
        const { studentId } = req.body;
        if (!studentId) return res.status(400).json({ message: 'Student ID is required.' });
        const student = await Student.findOne({ studentId });
        if (!student) return res.status(404).json({ message: 'No student found with this ID.' });
        const certificates = await Certificate.find({ studentId: student.studentId, status: 'Issued' });
        res.json({ student, certificates });
    } catch (error) { res.status(500).json({ message: 'Server error during lookup.' }); }
});

app.post('/api/verify', async (req, res) => {
    try {
        const { certificateId } = req.body;
        const certRecord = await Certificate.findOne({ certificateId: certificateId });
        if (!certRecord) return res.status(404).json({ isValid: false, message: 'Certificate ID not found.' });

        if (certRecord.status === 'Revoked') {
            return res.status(200).json({ isValid: false, message: 'This certificate has been revoked by the issuer.' });
        }

        const certificateData = `${certRecord.learnerName}-${certRecord.studentId}-${certRecord.courseName}`;
        const certificateHash = ethers.keccak256(ethers.toUtf8Bytes(certificateData));
        const isValidOnChain = await contract.verifyCertificate(certificateHash);
        
        const responseData = { ...certRecord.toObject(), ipfsLink: `https://gateway.pinata.cloud/ipfs/${certRecord.ipfsCid}` };
        
        if (isValidOnChain) {
            res.status(200).json({ isValid: true, message: 'Certificate is valid and verified on the blockchain.', data: responseData });
        } else {
            res.status(200).json({ isValid: false, message: 'Certificate NOT valid on blockchain.', data: responseData });
        }
    } catch (error) { 
        console.error("Verification error:", error);
        res.status(500).json({ message: 'An error occurred during verification.' }); 
    }
});

app.listen(PORT, () => {
    console.log(`Backend server is running successfully on http://localhost:${PORT}`);
});