import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    HashRouter as Router,
    Routes,
    Route,
    Link as RouterLink,
    useParams,
    useNavigate,
    useLocation,
} from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

// --- Material-UI Imports ---
import {
    Container, Typography, TextField, Button, Box, Paper, AppBar, Toolbar, Link,
    Grid, IconButton, Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, TableSortLabel, Collapse, CircularProgress, Snackbar, Alert, Tooltip,
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import {
    AddCircleOutline as AddCircleOutlineIcon,
    DeleteOutline as DeleteIcon,
    ContentCopy as ContentCopyIcon,
    ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

// --- CHANGE: Hardcoded Authorization Token ---
// This is your secret token. For evaluation purposes only.
const HARDCODED_AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJhYmhpdGVuZHJhc2luZ2gyMDAzQGdtYWlsLmNvbSIsImV4cCI6MTc1NzMyMzAzMiwiaWF0IjoxNzU3MzIyMTMyLCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiNjJjNzEwYWItNWQzMy00MzQ5LWEyMGQtZWRkMTQ0NjBkZjRiIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoiYWJoaXRlbmRyYSBzaW5naCIsInN1YiI6ImRmNDk0YmU4LTdlZDMtNGYyNS1iOWI1LWQyZWEyY2M0MzEzOSJ9LCJlbWFpbCI6ImFiaGl0ZW5kcmFzaW5naDIwMDNAZ21haWwuY29tIiwibmFtZSI6ImFiaGl0ZW5kcmEgc2luZ2giLCJyb2xsTm8iOiIyMjAxNjQwMTAwMDE2IiwiYWNjZXNzQ29kZSI6InNBV1R1UiIsImNsaWVudElEIjoiZGY0OTRiZTgtN2VkMy00ZjI1LWI5YjUtZDJlYTJjYzQzMTM5IiwiY2xpZW50U2VjcmV0IjoidlVOQkdxU2tnUEhTeUpmUSJ9.AjTw7b801348moShwXp1olu9BpaWYmZZzVLn9O7i-k0";
// --- END OF CHANGE ---

// --- Custom Logging Middleware (Mandatory Requirement) ---
const loggingService = {
    log: async (level, pkg, message) => {
        const LOG_API_URL = 'http://20.244.56.144/evaluation-service/logs';
        
        // --- CHANGE: Use the hardcoded token instead of localStorage ---
        const token = HARDCODED_AUTH_TOKEN;
        // --- END OF CHANGE ---

        if (!token) {
            console.log("[Logger Error] Auth Token not found. Cannot send log.");
            return; 
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        };

        const logPayload = {
            stack: 'frontend',
            level,
            package: pkg,
            message: typeof message === 'object' ? JSON.stringify(message) : String(message),
        };

        try {
            const response = await fetch(LOG_API_URL, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(logPayload),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.log(`[Logger Error] API call failed: ${response.status}`, { logPayload, errorBody });
            }
        } catch (error) {
            console.log('[Logger Error] Failed to send log due to network error:', { logPayload, error });
        }
    },
    info: (pkg, message) => loggingService.log('info', pkg, message),
    warn: (pkg, message) => loggingService.log('warn', pkg, message),
    error: (pkg, message, errorObj) => {
        const errorMessage = errorObj ? `${message} | Details: ${errorObj.toString()}` : message;
        loggingService.log('error', pkg, errorMessage);
    },
};

// --- URL Management Service ---
const URL_STORAGE_KEY = 'shortener_links';
const urlPersistenceService = {
    getAll: () => {
        try {
            const data = localStorage.getItem(URL_STORAGE_KEY);
            const mappings = data ? JSON.parse(data) : [];
            loggingService.info('utils', `Retrieved ${mappings.length} mappings.`);
            return mappings;
        } catch (e) {
            loggingService.error('utils', 'Failed to parse mappings from localStorage.', e);
            return [];
        }
    },
    saveAll: (mappings) => {
        try {
            localStorage.setItem(URL_STORAGE_KEY, JSON.stringify(mappings));
            loggingService.info('utils', `Saved ${mappings.length} mappings.`);
        } catch (e) {
            loggingService.error('utils', 'Failed to save mappings to localStorage.', e);
        }
    },
    add: (newMapping) => {
        const allMappings = urlPersistenceService.getAll();
        urlPersistenceService.saveAll([...allMappings, newMapping]);
    },
    findByShortcode: (shortcode) => {
        const mapping = urlPersistenceService.getAll().find(m => m.id === shortcode);
        if (!mapping) {
            loggingService.warn('utils', `No mapping found for shortcode: ${shortcode}`);
        }
        return mapping;
    },
    isShortcodeTaken: (shortcode) => urlPersistenceService.getAll().some(m => m.id === shortcode),
    recordClick: (shortcode) => {
        const mappings = urlPersistenceService.getAll();
        const mappingIndex = mappings.findIndex(m => m.id === shortcode);

        if (mappingIndex !== -1) {
            const mapping = mappings[mappingIndex];
            mapping.clicks++;
            mapping.clickDetails.push({
                timestamp: new Date().toISOString(),
                source: document.referrer || 'Direct Access',
                location: 'N/A', 
            });
            urlPersistenceService.saveAll(mappings);
            loggingService.info('component', `Click recorded for: ${shortcode}`);
            return mapping.longUrl;
        }
        return null;
    },
};

// --- Helper Functions ---
const generateShortcode = (length = 6) => {
    loggingService.info('utils', 'Generating a new shortcode.');
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    do {
        result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (urlPersistenceService.isShortcodeTaken(result));
    loggingService.info('utils', `Generated unique shortcode: ${result}`);
    return result;
};

const isValidUrl = (string) => {
    try {
        const url = new URL(string);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
        return false;
    }
};

// --- Application Theme ---
const appTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#0052cc' },
        secondary: { main: '#de350b' },
        background: { default: '#f4f5f7', paper: '#ffffff' },
    },
    typography: { fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" },
    components: {
        MuiButton: { styleOverrides: { root: { borderRadius: 8, textTransform: 'none', fontWeight: 600 } } },
        MuiPaper: { styleOverrides: { root: { borderRadius: 12 } } },
        MuiTextField: { defaultProps: { variant: 'outlined' }, styleOverrides: { root: { borderRadius: 8 } } },
    },
});

// --- UI Components ---

function Notification({ message, open, onClose }) {
    return (
        <Snackbar open={open} autoHideDuration={3000} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
            <Alert onClose={onClose} severity="success" sx={{ width: '100%', boxShadow: 3 }}>
                {message}
            </Alert>
        </Snackbar>
    );
}

function AppLayout({ children }) {
    const location = useLocation();
    const isSelected = (path) => location.pathname === path;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <AppBar position="sticky" elevation={1} sx={{ bgcolor: 'background.paper', color: 'text.primary' }}>
                <Container maxWidth="lg">
                    <Toolbar disableGutters>
                        <Typography variant="h6" fontWeight="bold" sx={{ flexGrow: 1 }}>
                            Short.ly
                        </Typography>
                        <Button component={RouterLink} to="/" variant={isSelected('/') ? 'contained' : 'text'}>Shorten</Button>
                        <Button component={RouterLink} to="/stats" sx={{ ml: 1 }} variant={isSelected('/stats') ? 'contained' : 'text'}>Statistics</Button>
                    </Toolbar>
                </Container>
            </AppBar>
            <Box component="main" sx={{ flexGrow: 1, py: { xs: 3, md: 5 } }}>
                <Container maxWidth="lg">{children}</Container>
            </Box>
        </Box>
    );
}

// --- URL Shortener Page ---
function ShortenerPage() {
    const [inputs, setInputs] = useState([{ id: uuidv4(), longUrl: '', validity: '30', customShortcode: '', error: '' }]);
    const [results, setResults] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [notification, setNotification] = useState({ open: false, message: '' });

    useEffect(() => {
        loggingService.info('page', 'ShortenerPage loaded.');
    }, []);

    const handleInputChange = (id, field, value) => {
        setInputs(currentInputs =>
            currentInputs.map(input => (input.id === id ? { ...input, [field]: value, error: '' } : input))
        );
    };

    const addInput = () => {
        if (inputs.length < 5) {
            loggingService.info('component', 'Adding a new URL input field.');
            setInputs([...inputs, { id: uuidv4(), longUrl: '', validity: '30', customShortcode: '', error: '' }]);
        }
    };

    const removeInput = (id) => {
        if (inputs.length > 1) {
            loggingService.info('component', `Removing URL input field with id: ${id}`);
            setInputs(inputs.filter(input => input.id !== id));
        }
    };

    const validateAndSubmit = (event) => {
        event.preventDefault();
        loggingService.info('component', 'Form submission initiated.');
        let allValid = true;
        const validatedInputs = inputs.map(input => {
            if (!isValidUrl(input.longUrl)) {
                allValid = false;
                return { ...input, error: 'Please enter a valid URL (e.g., https://example.com).' };
            }
            if (input.customShortcode && !/^[a-zA-Z0-9_-]{3,16}$/.test(input.customShortcode)) {
                allValid = false;
                return { ...input, error: 'Shortcode must be 3-16 alphanumeric characters.' };
            }
            if (input.customShortcode && urlPersistenceService.isShortcodeTaken(input.customShortcode)) {
                allValid = false;
                return { ...input, error: `Shortcode "${input.customShortcode}" is already taken.` };
            }
            return input;
        });

        setInputs(validatedInputs);

        if (allValid) {
            loggingService.info('state', 'Validation successful. Processing URLs.');
            setIsSubmitting(true);
            setTimeout(() => {
                const newResults = inputs.map(input => {
                    const shortcode = input.customShortcode.trim() || generateShortcode();
                    const newMapping = {
                        id: shortcode,
                        longUrl: input.longUrl,
                        shortUrl: `${window.location.origin}${window.location.pathname}#/${shortcode}`,
                        createdAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + (parseInt(input.validity, 10) || 30) * 60 * 1000).toISOString(),
                        clicks: 0,
                        clickDetails: [],
                    };
                    urlPersistenceService.add(newMapping);
                    return { ...newMapping, original: input.longUrl };
                });
                setResults(newResults);
                setIsSubmitting(false);
                setInputs([{ id: uuidv4(), longUrl: '', validity: '30', customShortcode: '', error: '' }]);
            }, 500);
        } else {
            loggingService.warn('component', 'Input validation failed.');
        }
    };

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        setNotification({ open: true, message: 'Copied to clipboard!' });
        loggingService.info('component', `Copied text: ${text}`);
    };

    return (
        <>
            <Paper elevation={0} sx={{ p: { xs: 2, md: 4 }, border: '1px solid #dfe1e6' }}>
                <Typography variant="h4" fontWeight="bold" align="center">Create Short Links</Typography>
                <Typography color="text.secondary" align="center" sx={{ mt: 1, mb: 4 }}>
                    Shorten up to 5 URLs at once. Links are active for a specified duration.
                </Typography>
                <form onSubmit={validateAndSubmit}>
                    <Grid container spacing={2}>
                        <AnimatePresence>
                            {inputs.map((input, index) => (
                                <Grid item xs={12} key={input.id} component={motion.div} layout initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
                                    <Box sx={{ p: 2, border: '1px solid #eee', borderRadius: 2, position: 'relative' }}>
                                        {inputs.length > 1 && (
                                            <Tooltip title="Remove URL">
                                                <IconButton onClick={() => removeInput(input.id)} size="small" sx={{ position: 'absolute', top: 8, right: 8 }}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        <TextField fullWidth label={`Original Long URL #${index + 1}`} name="longUrl" value={input.longUrl} onChange={(e) => handleInputChange(input.id, 'longUrl', e.target.value)} required error={!!input.error} helperText={input.error} />
                                        <Grid container spacing={2} sx={{ mt: 0.5 }}>
                                            <Grid item xs={12} sm={6}>
                                                <TextField fullWidth label="Custom Shortcode (Optional)" name="customShortcode" value={input.customShortcode} onChange={(e) => handleInputChange(input.id, 'customShortcode', e.target.value)} />
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <TextField fullWidth label="Validity (minutes)" name="validity" type="number" value={input.validity} onChange={(e) => handleInputChange(input.id, 'validity', e.target.value)} />
                                            </Grid>
                                        </Grid>
                                    </Box>
                                </Grid>
                            ))}
                        </AnimatePresence>
                    </Grid>
                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Button onClick={addInput} disabled={inputs.length >= 5} startIcon={<AddCircleOutlineIcon />}>Add URL</Button>
                        <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
                            {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Shorten Links'}
                        </Button>
                    </Box>
                </form>
            </Paper>
            {results.length > 0 && (
                <Box sx={{ mt: 4 }}>
                    <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>Your Links are Ready</Typography>
                    {results.map(result => (
                        <Paper key={result.id} variant="outlined" sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center' }}>
                            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                                <Typography noWrap color="text.secondary" title={result.original}>Original: {result.original}</Typography>
                                <Link component={RouterLink} to={`/${result.id}`} target="_blank" variant="h6">{result.shortUrl}</Link>
                                <Typography variant="caption" display="block">Expires: {new Date(result.expiresAt).toLocaleString()}</Typography>
                            </Box>
                            <Tooltip title="Copy Short Link">
                                <IconButton onClick={() => handleCopy(result.shortUrl)}><ContentCopyIcon /></IconButton>
                            </Tooltip>
                        </Paper>
                    ))}
                </Box>
            )}
            <Notification open={notification.open} message={notification.message} onClose={() => setNotification({ ...notification, open: false })} />
        </>
    );
}


// --- Statistics Page ---
function StatsTableRow({ row }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
                <TableCell>
                    <Link component={RouterLink} to={`/${row.id}`} target="_blank">{row.shortUrl}</Link>
                    <Typography variant="caption" display="block" color="text.secondary" noWrap sx={{ maxWidth: '250px' }}>{row.longUrl}</Typography>
                </TableCell>
                <TableCell align="center">{row.clicks}</TableCell>
                <TableCell>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(row.expiresAt).toLocaleString()}</TableCell>
                <TableCell>
                    <IconButton size="small" onClick={() => setOpen(!open)} disabled={row.clicks === 0}>
                        <ExpandMoreIcon style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                    </IconButton>
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                        <Box sx={{ m: 1 }}>
                            <Typography variant="h6" gutterBottom>Click History</Typography>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Timestamp</TableCell>
                                        <TableCell>Source (Referrer)</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {row.clickDetails.map((detail, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{new Date(detail.timestamp).toLocaleString()}</TableCell>
                                            <TableCell>{detail.source}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
}

function StatisticsPage() {
    const [mappings, setMappings] = useState([]);
    const [order, setOrder] = useState('desc');
    const [orderBy, setOrderBy] = useState('createdAt');

    useEffect(() => {
        loggingService.info('page', 'StatisticsPage loaded.');
        const allMappings = urlPersistenceService.getAll();
        const activeMappings = allMappings.filter(m => new Date(m.expiresAt) > new Date());
        if (activeMappings.length < allMappings.length) {
            loggingService.info('state', `Pruned ${allMappings.length - activeMappings.length} expired links.`);
            urlPersistenceService.saveAll(activeMappings);
        }
        setMappings(activeMappings);
    }, []);

    const handleSort = (property) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
        loggingService.info('component', `Sorting stats by ${property} in ${isAsc ? 'desc' : 'asc'} order.`);
    };

    const sortedMappings = useMemo(() => {
        return [...mappings].sort((a, b) => {
            const isDate = ['createdAt', 'expiresAt'].includes(orderBy);
            const aVal = isDate ? new Date(a[orderBy]) : a[orderBy];
            const bVal = isDate ? new Date(b[orderBy]) : b[orderBy];
            if (bVal < aVal) return order === 'asc' ? 1 : -1;
            if (bVal > aVal) return order === 'asc' ? -1 : 1;
            return 0;
        });
    }, [mappings, order, orderBy]);

    return (
        <Paper elevation={0} sx={{ p: { xs: 2, md: 4 }, border: '1px solid #dfe1e6' }}>
            <Typography variant="h4" fontWeight="bold" align="center">URL Statistics</Typography>
            <Typography color="text.secondary" align="center" sx={{ mt: 1, mb: 4 }}>
                Review the performance of your active short links.
            </Typography>
            {mappings.length === 0 ? (
                <Typography align="center" sx={{ mt: 5 }}>No active links found. Go ahead and create one!</Typography>
            ) : (
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                {['shortUrl', 'clicks', 'createdAt', 'expiresAt'].map(headCell => (
                                    <TableCell key={headCell} sortDirection={orderBy === headCell ? order : false} align={headCell === 'clicks' ? 'center' : 'left'}>
                                        <TableSortLabel active={orderBy === headCell} direction={orderBy === headCell ? order : 'asc'} onClick={() => handleSort(headCell)}>
                                            {headCell.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                        </TableSortLabel>
                                    </TableCell>
                                ))}
                                <TableCell />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sortedMappings.map(row => <StatsTableRow key={row.id} row={row} />)}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Paper>
    );
}

// --- Redirect Handler ---
function RedirectHandler() {
    const { shortcode } = useParams();
    const [status, setStatus] = useState({ loading: true, error: '' });

    useEffect(() => {
        loggingService.info('page', `Redirecting for shortcode: ${shortcode}`);
        const mapping = urlPersistenceService.findByShortcode(shortcode);

        if (!mapping) {
            setStatus({ loading: false, error: `The link "${shortcode}" was not found.` });
            return;
        }

        if (new Date(mapping.expiresAt) < new Date()) {
            setStatus({ loading: false, error: 'This link has expired.' });
            return;
        }

        const longUrl = urlPersistenceService.recordClick(shortcode);
        window.location.href = longUrl;
    }, [shortcode]);

    if (status.error) {
        return (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h5" color="error" gutterBottom>Redirect Failed</Typography>
                <Typography>{status.error}</Typography>
                <Button component={RouterLink} to="/" variant="contained" sx={{ mt: 3 }}>Go to Homepage</Button>
            </Paper>
        );
    }

    return (
        <Box sx={{ textAlign: 'center', p: 5 }}>
            <CircularProgress />
            <Typography sx={{ mt: 2 }}>Redirecting you now...</Typography>
        </Box>
    );
}

// --- Main App Component ---
export default function App() {
    return (
        <ThemeProvider theme={appTheme}>
            <Router>
                <AppLayout>
                    <Routes>
                        <Route path="/" element={<ShortenerPage />} />
                        <Route path="/stats" element={<StatisticsPage />} />
                        <Route path="/:shortcode" element={<RedirectHandler />} />
                    </Routes>
                </AppLayout>
            </Router>
        </ThemeProvider>
    );
}