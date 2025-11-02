import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './App.css';

// Using process.env.VITE_BACKEND_IP for Vite projects to access .env variables
const BACKEND_IP = import.meta.env.VITE_BACKEND_IP || 'localhost'; // Default to localhost if not set
const API_URL = `http://${BACKEND_IP}:4000/api`;

// ================== HELPER FUNCTIONS ==================
const getToken = () => localStorage.getItem('token');
const getDecodedToken = () => {
    const token = getToken();
    if (!token) return null;
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        console.error("Error decoding token:", e);
        return null;
    }
};

const NCVET_COURSES = [ "Certificate Course in Wood Carving", "Diploma Course in Furniture Design and Making", "Certificate Course in PLC Programming", "Diploma Course in Industrial Robotics", "Certificate Course in Mobile Phone Repair", "Diploma Course in Telecommunication Network Engineering", "Certificate Course in Internet of Things (IoT) Fundamentals", "Diploma Course in Cybersecurity for Telecom Networks", "Certificate Course in SCADA Systems", "Diploma Course in Process Automation" ];

// ================== PAGES & COMPONENTS ==================

function WelcomePage({ navigate }) {
    const { t } = useTranslation();
    return (
        <div className="welcome-container">
            <h1>{t('welcome_title', 'Blockchain Skill Credentialing System')}</h1>
            <p className="subtitle">{t('welcome_subtitle', 'An NCVET platform for issuing and verifying tamper-proof digital credentials.')}</p>
            <div className="button-group">
                <button className="nav-button primary" onClick={() => navigate('verifier')}>{t('nav_verifier', 'Verifier')}</button>
                <button className="nav-button secondary" onClick={() => navigate('student-lookup')}>{t('welcome_view_certs', 'View Certificates')}</button>
            </div>
        </div>
    );
}

// In src/App.jsx, replace the old StudentLookupPage function with this one

function StudentLookupPage({ navigate }) {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [studentData, setStudentData] = useState(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLookup = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setStudentData(null);
        try {
            const endpoint = `${API_URL}/student/lookup`;
            const body = { email };
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to find student');
            setStudentData(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (studentData) {
        return (
            <div className="dashboard-container">
                <div className="results-header">
                    <h2>{studentData.student.name}'s Certificates</h2>
                    {/* The button is no longer here */}
                </div>

                <div className="cert-list">
                    {studentData.certificates?.length > 0 ? (
                        studentData.certificates.map(cert => (
                            <div key={cert._id} className="cert-card">
                                <h3>{cert.courseName}</h3>
                                <p><strong>Certificate ID:</strong> {cert.certificateId}</p>
                                <div className="card-links">
                                    <a href={`https://gateway.pinata.cloud/ipfs/${cert.ipfsCid}`} target="_blank" rel="noopener noreferrer">View PDF</a>
                                    <a href={`https://sepolia.etherscan.io/tx/${cert.transactionHash}`} target="_blank" rel="noopener noreferrer">View on Blockchain</a>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p>No certificates have been issued for this email address yet.</p>
                    )}
                </div>

                {/* --- BUTTON MOVED HERE, TO THE BOTTOM --- */}
                <button className="back-button" onClick={() => { setStudentData(null); setEmail(''); }}>
                    Back to Search
                </button>
            </div>
        );
    }

    // The initial search form remains the same
    return (
        <div className="portal-box">
            <h2>View My Certificates</h2>
            <p>Enter your registered email address to find your certificates.</p>
            <form onSubmit={handleLookup}>
                <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input-field"
                    placeholder="Enter Your Email Address"
                    required
                />
                <button type="submit" className="action-button primary" disabled={isLoading}>
                    {isLoading ? 'Searching...' : 'Find My Certificates'}
                </button>
            </form>
            {error && <p className="result-box result-invalid">{error}</p>}
            <button className="back-button" style={{width: '100%'}} onClick={() => navigate('welcome')}>
                {t('verify_back_home', 'Back to Home')}
            </button>
        </div>
    );
}

function AdminLoginPage({ navigate, onLoginSuccess }) {
    const { t } = useTranslation();
    const [adminId, setAdminId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_URL}/auth/admin-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminId, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to login');
            onLoginSuccess(data.token);
        } catch (err) { setError(err.message); }
        finally { setIsLoading(false); }
    };

    return (
        <div className="portal-box">
            <h2>Admin Login</h2>
            <form onSubmit={handleLogin}>
                <label>Admin ID</label>
                <input type="text" value={adminId} onChange={e => setAdminId(e.target.value)} className="input-field" required />
                <label>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" required />
                <button type="submit" className="action-button admin-login" disabled={isLoading}>{isLoading ? 'Logging in...' : 'Login'}</button>
            </form>
            {error && <p className="result-box result-invalid">{error}</p>}
            <button className="back-button" onClick={() => navigate('welcome')}>{t('verify_back_home')}</button>
        </div>
    );
}

function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('students');
    const [students, setStudents] = useState([]);
    const [filteredStudents, setFilteredStudents] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [institutions, setInstitutions] = useState([]);
    const [newInstName, setNewInstName] = useState('');
    const [newInstAddress, setNewInstAddress] = useState('');
    const [instStatus, setInstStatus] = useState('');
    const [isEnrollModalOpen, setEnrollModalOpen] = useState(false);
    const [courseToEnroll, setCourseToEnroll] = useState('');
    const [enrollStatus, setEnrollStatus] = useState('');
    const [issueStatus, setIssueStatus] = useState({ message: '', link: '' });
    const [burnStatus, setBurnStatus] = useState({ message: '' });
    const [isLoading, setIsLoading] = useState(false);

    const fetchAllData = async () => {
        try {
            const [studentsRes, instRes] = await Promise.all([
                fetch(`${API_URL}/admin/students`, { headers: { 'x-auth-token': getToken() } }),
                fetch(`${API_URL}/admin/institutions`, { headers: { 'x-auth-token': getToken() } })
            ]);
            if (!studentsRes.ok) throw new Error("Could not fetch students");
            if (!instRes.ok) throw new Error("Could not fetch institutions");
            const studentsData = await studentsRes.json();
            const instData = await instRes.json();
            setStudents(studentsData);
            setInstitutions(instData);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => { fetchAllData(); }, []);

    useEffect(() => {
        setFilteredStudents(
            students.filter(s =>
                (s.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (s.studentId?.toLowerCase().includes(searchTerm.toLowerCase()))
            )
        );
    }, [searchTerm, students]);

    useEffect(() => {
        if (selectedStudent) {
            const refreshedStudent = students.find(s => s._id === selectedStudent._id);
            if(refreshedStudent) setSelectedStudent(refreshedStudent);
        }
    }, [students]);

    const handleIssue = async (courseName) => {
        if (!selectedStudent) return;
        setIsLoading(true);
        setIssueStatus({ message: `Issuing certificate for ${courseName}...`, link: '' });
        try {
            const response = await fetch(`${API_URL}/issue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': getToken() },
                body: JSON.stringify({ studentId: selectedStudent.studentId, courseName }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            setIssueStatus({ message: data.message, link: data.ipfsLink });
            fetchAllData();
        } catch (error) {
            setIssueStatus({ message: `Error: ${error.message}`, link: '' });
        } finally {
            setIsLoading(false);
            setTimeout(() => setIssueStatus({ message: '', link: '' }), 10000);
        }
    };

    const handleBurn = async (certificateId) => {
        if (!certificateId) return;
        setIsLoading(true);
        setBurnStatus({ message: `Revoking certificate...` });
        try {
            const response = await fetch(`${API_URL}/admin/burn-certificate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': getToken() },
                body: JSON.stringify({ certificateId }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            setBurnStatus({ message: data.message });
            fetchAllData();
        } catch (error) {
            setBurnStatus({ message: `Error: ${error.message}` });
        } finally {
            setIsLoading(false);
            setTimeout(() => setBurnStatus({ message: '' }), 10000);
        }
    };

    const handleAddInstitution = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setInstStatus('Adding institution...');
        try {
            const res = await fetch(`${API_URL}/admin/institutions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': getToken() },
                body: JSON.stringify({ name: newInstName, walletAddress: newInstAddress }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setInstStatus(`Successfully added ${newInstName}.`);
            setNewInstName('');
            setNewInstAddress('');
            fetchAllData();
        } catch (error) {
            setInstStatus(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
            setTimeout(() => setInstStatus(''), 5000);
        }
    };
    
    const handleEnrollStudent = async (e) => {
        e.preventDefault();
        if (!courseToEnroll || !selectedStudent) return;
        setIsLoading(true);
        setEnrollStatus(`Enrolling in ${courseToEnroll}...`);
        try {
            const res = await fetch(`${API_URL}/admin/enroll`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': getToken() },
                body: JSON.stringify({ studentId: selectedStudent.studentId, courseName: courseToEnroll }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setEnrollStatus('Successfully enrolled!');
            fetchAllData();
            setTimeout(() => {
                setEnrollModalOpen(false);
                setEnrollStatus('');
                setCourseToEnroll('');
            }, 2000);
        } catch (error) {
            setEnrollStatus(`Error: ${error.message}`);
            setTimeout(() => setEnrollStatus(''), 5000);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="admin-dashboard">
            <h2>NCVET Admin Dashboard</h2>
            <div className="admin-tabs">
                <button onClick={() => setActiveTab('students')} className={activeTab === 'students' ? 'active' : ''}>Student Management</button>
                <button onClick={() => setActiveTab('institutions')} className={activeTab === 'institutions' ? 'active' : ''}>Institution Management</button>
            </div>

            {activeTab === 'students' && (
                <div className="admin-layout">
                    <div className="student-list-panel">
                        <h3>Student Database ({students.length})</h3>
                        <input type="text" placeholder="Filter by name or ID..." className="input-field filter-input" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <div className="student-list">
                            {filteredStudents.map(student => (
                                <div key={student._id} className={`student-item ${selectedStudent?._id === student._id ? 'selected' : ''}`} onClick={() => setSelectedStudent(student)}>
                                    <p className="student-name">{student.name}</p>
                                    <p className="student-id">ID: {student.studentId}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="issue-panel">
                        <h3>Student Profile & Enrollments</h3>
                        {selectedStudent ? (
                            <div className="issue-form">
                                <div className="student-details-card">
                                    <p><strong>Name:</strong> {selectedStudent.name}</p>
                                    <p><strong>Email:</strong> {selectedStudent.email || 'N/A'}</p>
                                    <p><strong>NCVET ID:</strong> {selectedStudent.studentId}</p>
                                </div>
                                <h4>Course Enrollments</h4>
                                <div className="enrollments">
                                    {selectedStudent.enrollments?.map((enrollment, index) => (
                                        <div key={index} className="enrollment-item">
                                            <span>{enrollment.courseName}</span>
                                            <div className="enrollment-actions">
                                                {enrollment.status === 'Certified' ? (
                                                    <>
                                                        <a href={`https://gateway.pinata.cloud/ipfs/${enrollment.ipfsCid}`} target="_blank" rel="noopener noreferrer" className="status-chip certified">View Cert</a>
                                                        <a href={`https://sepolia.etherscan.io/tx/${enrollment.transactionHash}`} target="_blank" rel="noopener noreferrer" className="tx-link">View Tx</a>
                                                        <button className="action-button revoke-certificate" onClick={() => handleBurn(enrollment.certificateId)} disabled={isLoading}>Revoke</button>
                                                    </>
                                                ) : enrollment.status === 'Revoked' ? (
                                                    <span className="status-chip revoked">Revoked</span>
                                                ) : (
                                                    <button className="action-button issue-enrollment" onClick={() => handleIssue(enrollment.courseName)} disabled={isLoading}>Issue Certificate</button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button className="action-button enroll-new" onClick={() => { setEnrollModalOpen(true); setCourseToEnroll(''); }}>+ Enroll in New Course</button>
                                {issueStatus.message && <div className={`result-box ${issueStatus.link ? 'result-valid' : 'result-invalid'}`}>{issueStatus.message}</div>}
                                {burnStatus.message && <div className={`result-box ${burnStatus.message.includes('Error') ? 'result-invalid' : 'result-valid'}`}>{burnStatus.message}</div>}
                            </div>
                        ) : (<p>Please select a student from the list.</p>)}
                    </div>
                </div>
            )}

            {activeTab === 'institutions' && (
                <div className="admin-layout">
                    <div className="student-list-panel">
                        <h3>Registered Institutions ({institutions.length})</h3>
                        <div className="institution-list">
                            {institutions.map(inst => (
                                <div key={inst._id} className="institution-item">
                                    <div>
                                        <p className="inst-name">{inst.name}</p>
                                        <p className="inst-address">{inst.walletAddress}</p>
                                    </div>
                                    {inst.isMinter && <span className="status-chip certified">Minter</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="issue-panel institution-panel">
                        <h3>Add New Institution</h3>
                        <form onSubmit={handleAddInstitution} className="institution-form">
                            <label>Institution Name</label>
                            <input type="text" value={newInstName} onChange={e => setNewInstName(e.target.value)} className="input-field" required />
                            <label>Institution Wallet Address</label>
                            <input type="text" value={newInstAddress} onChange={e => setNewInstAddress(e.target.value)} className="input-field" required />
                            <button type="submit" className="action-button" disabled={isLoading}>{isLoading ? 'Adding...' : 'Add Institution'}</button>
                            {instStatus && <p className="result-box result-valid">{instStatus}</p>}
                        </form>
                    </div>
                </div>
            )}

            {isEnrollModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Enroll {selectedStudent?.name} in a New Course</h3>
                        <form onSubmit={handleEnrollStudent}>
                            <label>Select a Course</label>
                            <select value={courseToEnroll} onChange={e => setCourseToEnroll(e.target.value)} className="input-field" required>
                                <option value="" disabled>-- Please choose a course --</option>
                                {NCVET_COURSES.map(course => (
                                    <option key={course} value={course}>{course}</option>
                                ))}
                            </select>
                            <div className="modal-actions">
                                <button type="button" className="back-button" onClick={() => setEnrollModalOpen(false)}>Cancel</button>
                                {/* --- THIS IS THE CORRECTED LINE --- */}
                                <button type="submit" className="action-button primary" disabled={isLoading}>
                                    {isLoading ? 'Enrolling...' : 'Confirm Enrollment'}
                                </button>
                            </div>
                            {enrollStatus && <p className="result-box result-valid">{enrollStatus}</p>}
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// In src/App.jsx, replace the old VerifierPortal function with this one

function VerifierPortal({ initialId, navigate }) {
    const { t } = useTranslation();
    const [certificateId, setCertificateId] = useState(initialId || '');
    const [result, setResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const runVerification = async (idToVerify) => {
        if (!idToVerify?.trim()) return;
        setIsLoading(true);
        setResult(null);
        try {
            const response = await fetch(`${API_URL}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ certificateId: idToVerify }),
            });
            const data = await response.json();
            
            const messageKey = "verify_" + data.message.toLowerCase().replace(/[\s.:!']/g, '_');
            setResult({ ...data, translatedMessage: t(messageKey, data.message) });

        } catch (error) {
            setResult({ isValid: false, translatedMessage: t('verify_error') });
        } finally { 
            setIsLoading(false); 
        }
    };

    useEffect(() => { if (initialId) { runVerification(initialId); } }, [initialId]);

    return (
        <div className="portal-box">
            <h2>{t('verify_title')}</h2>
            <form onSubmit={(e) => { e.preventDefault(); runVerification(certificateId); }}>
                <input
                    type="text"
                    placeholder={t('verify_placeholder')}
                    className="input-field"
                    value={certificateId}
                    onChange={(e) => setCertificateId(e.target.value)}
                />
                <button className="action-button primary" type="submit" disabled={isLoading}>
                    {isLoading ? 'Verifying...' : t('verify_button')}
                </button>
            </form>

            {result && (
                <div className={`result-box ${result.isValid ? 'result-valid' : 'result-invalid'}`}>
                    <p className="result-message">{result.translatedMessage}</p>
                    
                    {/* --- NEWLY ADDED SECTION --- */}
                    {result.isValid && result.data && (
                        <div className="cert-details">
                            <p><strong>Learner:</strong> {result.data.learnerName}</p>
                            <p><strong>Course:</strong> {result.data.courseName}</p>
                            <div className="cert-details-links">
                                <a href={result.data.ipfsLink} target="_blank" rel="noopener noreferrer">View Certificate</a>
                                <a href={`https://sepolia.etherscan.io/tx/${result.data.transactionHash}`} target="_blank" rel="noopener noreferrer">View Tx</a>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            <button className="back-button" onClick={() => navigate('welcome')}>
                {t('verify_back_home')}
            </button>
        </div>
    );
}
function App() {
    const { t, i18n } = useTranslation();
    const [page, setPage] = useState('welcome');
    const [token, setToken] = useState(getToken());

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const idFromUrl = params.get('id');
        if (idFromUrl) {
            setPage('verifier');
        }
    }, []);

    const handleLoginSuccess = (newToken) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
        setPage('admin-dashboard');
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setPage('welcome');
    };
    
    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
    };

    const renderPage = () => {
        if (token && getDecodedToken()?.user?.role === 'admin') {
            return <AdminDashboard />;
        }
        switch (page) {
            case 'student-lookup': return <StudentLookupPage navigate={setPage} />;
            case 'admin-login': return <AdminLoginPage navigate={setPage} onLoginSuccess={handleLoginSuccess} />;
            case 'verifier': return <VerifierPortal navigate={setPage} initialId={new URLSearchParams(window.location.search).get('id')} />;
            default: return <WelcomePage navigate={setPage} />;
        }
    };

    return (
        <div className="app-layout">
            <header className="app-header">
                <div className="logo" onClick={() => setPage('welcome')}>{t('logo')}</div>
                <nav>
                    <div className="lang-toggle">
                        <button onClick={() => changeLanguage('en')} className={i18n.language === 'en' ? 'active' : ''}>EN</button>
                        <button onClick={() => changeLanguage('hi')} className={i18n.language === 'hi' ? 'active' : ''}>HI</button>
                    </div>

                    {token ? (
                        <a href="#" onClick={handleLogout}>{t('nav_logout')}</a>
                    ) : (
                        <a href="#" onClick={() => setPage('admin-login')}>{t('nav_admin_login')}</a>
                    )}
                </nav>
            </header>
            <main className="app-content">
                {renderPage()}
            </main>
        </div>
    );
}

export default App;