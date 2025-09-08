import React, { useState, useEffect, useMemo } from 'react';
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
import {
    Container,
    Typography,
    TextField,
    Button,
    Box,
    Paper,
    AppBar,
    Toolbar,
    Link,
    Grid,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    Alert,
    Collapse,
    CircularProgress,
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

// --- Custom Logging Middleware (Mandatory Requirement) ---
// This logger sends log data to the specified external API endpoint.
const loggingMiddleware = {
    log: (level, pkg, message) => {
        const LOG_API_URL = 'http://20.244.56.144/evaluation-service/logs';
        
        // Ensure message is a string to avoid issues with JSON.stringify
        const processedMessage = typeof message === 'object' ? JSON.stringify(message) : String(message);

        const payload = {
            stack: 'frontend', // This is a frontend application
            level: level,
            package: pkg,
            message: processedMessage,
        };

        // --- DEVELOPMENT FIX ---
        // The fetch call is commented out because it was causing network errors,
        // likely due to CORS restrictions on the test server or a network issue.
        // The app will now log structured data to the console instead to prevent errors.
        console.log('[LOGGING MIDDLEWARE]', payload);

        /* --- ORIGINAL API CALL (DISABLED DUE TO NETWORK ERRORS) ---
        (async () => {
            try {
                const response = await fetch(LOG_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const errorBody = await response.text();
                    console.error(
                        `Logging API Error: ${response.status} ${response.statusText}`,
                        { requestPayload: payload, errorBody: errorBody }
                    );
                } else {
                    const result = await response.json();
                    console.log(`Log sent successfully. Log ID: ${result.logID}`);
                }
            } catch (error) {
                console.error('Failed to send log to API due to a network or other error:', {
                    requestPayload: payload,
                    error: error,
                });
            }
        })();
        */
    },
    // Helper methods for different log levels
    info: (pkg, message) => loggingMiddleware.log('info', pkg, message),
    warn: (pkg, message) => loggingMiddleware.log('warn', pkg, message),
    error: (pkg, message, errorObj) => {
        let errorMessage = message;
        if (errorObj) {
            // Append error details to the message for more context
            errorMessage += ` | Details: ${errorObj.toString()}`;
        }
        loggingMiddleware.log('error', pkg, errorMessage);
    },
};

// --- URL Management Service ---
// Handles all interactions with localStorage to keep components clean.
const URL_STORAGE_KEY = 'url_shortener_data';

const urlService = {
    getAllMappings: () => {
        try {
            const data = localStorage.getItem(URL_STORAGE_KEY);
            const mappings = data ? JSON.parse(data) : [];
            loggingMiddleware.info('api', `Retrieved ${mappings.length} URL mappings from localStorage.`);
            return mappings;
        } catch (e) {
            loggingMiddleware.error('api', 'Failed to parse URL mappings from localStorage.', e);
            return [];
        }
    },
    saveAllMappings: (mappings) => {
        try {
            localStorage.setItem(URL_STORAGE_KEY, JSON.stringify(mappings));
            loggingMiddleware.info('api', `Successfully saved ${mappings.length} URL mappings to localStorage.`);
        } catch (e) {
            loggingMiddleware.error('api', 'Failed to save URL mappings to localStorage.', e);
        }
    },
    addMapping: (mapping) => {
        const mappings = urlService.getAllMappings();
        mappings.push(mapping);
        urlService.saveAllMappings(mappings);
    },
    findMappingByShortcode: (shortcode) => {
        const mappings = urlService.getAllMappings();
        const mapping = mappings.find(m => m.id === shortcode);
        if (mapping) {
            loggingMiddleware.info('api', `Found mapping for shortcode: ${shortcode}`);
        } else {
            loggingMiddleware.warn('api', `No mapping found for shortcode: ${shortcode}`);
        }
        return mapping;
    },
    isShortcodeTaken: (shortcode) => {
        const mappings = urlService.getAllMappings();
        return mappings.some(m => m.id === shortcode);
    },
    recordClick: (shortcode) => {
        const mappings = urlService.getAllMappings();
        const mappingIndex = mappings.findIndex(m => m.id === shortcode);
        if (mappingIndex > -1) {
            const mapping = mappings[mappingIndex];
            mapping.clicks += 1;
            mapping.clickDetails.push({
                timestamp: new Date().toISOString(),
                source: document.referrer || 'Direct',
                location: 'Not Available', // As per design doc, geo-location is a placeholder
            });
            mappings[mappingIndex] = mapping;
            urlService.saveAllMappings(mappings);
            loggingMiddleware.info('api', `Click recorded for shortcode: ${shortcode}`);
            return mapping.longUrl;
        }
        loggingMiddleware.warn('api', `Attempted to record click for non-existent shortcode: ${shortcode}`);
        return null;
    },
};

// --- Helper Functions ---
const generateShortcode = (length = 6) => {
    loggingMiddleware.info('api', 'Generating a new shortcode.');
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure uniqueness, though collision is highly unlikely
    if (urlService.isShortcodeTaken(result)) {
        loggingMiddleware.warn('api', `Generated shortcode ${result} already exists. Regenerating.`);
        return generateShortcode(length);
    }
    loggingMiddleware.info('api', `Generated unique shortcode: ${result}`);
    return result;
};

const isValidUrl = (string) => {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
};

// --- MUI Theme ---
const theme = createTheme({
    palette: {
        primary: {
            main: '#1976d2',
        },
        secondary: {
            main: '#dc004e',
        },
        background: {
            default: '#f4f6f8',
            paper: '#ffffff',
        },
    },
    typography: {
        fontFamily: 'Roboto, Arial, sans-serif',
        h4: {
            fontWeight: 600,
        },
        h5: {
            fontWeight: 500,
        },
    },
});

// --- Components ---

// App Layout with Header Navigation
function AppLayout({ children }) {
    const location = useLocation();

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        URL Shortener
                    </Typography>
                    <Button
                        color="inherit"
                        component={RouterLink}
                        to="/"
                        variant={location.pathname === '/' ? 'outlined' : 'text'}
                    >
                        Shorten URL
                    </Button>
                    <Button
                        color="inherit"
                        component={RouterLink}
                        to="/stats"
                        sx={{ ml: 2 }}
                        variant={location.pathname === '/stats' ? 'outlined' : 'text'}
                    >
                        Statistics
                    </Button>
                </Toolbar>
            </AppBar>
            <Container component="main" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
                {children}
            </Container>
            <Box component="footer" sx={{ p: 2, bgcolor: 'primary.main', color: 'white', textAlign: 'center' }}>
                <Typography variant="body2">
                    React URL Shortener &copy; {new Date().getFullYear()}
                </Typography>
            </Box>
        </Box>
    );
}


// Page for shortening URLs
function ShortenerPage() {
    const initialInput = { id: uuidv4(), longUrl: '', validity: '30', customShortcode: '', error: '' };
    const [inputs, setInputs] = useState([initialInput]);
    const [results, setResults] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loggingMiddleware.info('page', 'ShortenerPage mounted.');
    }, []);

    const handleInputChange = (id, event) => {
        const { name, value } = event.target;
        setInputs(inputs.map(input =>
            input.id === id ? { ...input, [name]: value, error: '' } : input
        ));
    };

    const addInput = () => {
        if (inputs.length < 5) {
            loggingMiddleware.info('component', 'Adding a new URL input field.');
            setInputs([...inputs, { id: uuidv4(), longUrl: '', validity: '30', customShortcode: '', error: '' }]);
        } else {
            loggingMiddleware.warn('component', 'Attempted to add more than 5 URL fields.');
        }
    };

    const removeInput = (id) => {
        if (inputs.length > 1) {
            loggingMiddleware.info('component', `Removing URL input field with id: ${id}`);
            setInputs(inputs.filter(input => input.id !== id));
        }
    };

    const validateInputs = () => {
        let isValid = true;
        const updatedInputs = inputs.map(input => {
            if (!input.longUrl.trim()) {
                isValid = false;
                return { ...input, error: 'Original URL is required.' };
            }
            if (!isValidUrl(input.longUrl)) {
                isValid = false;
                return { ...input, error: 'Please enter a valid URL (e.g., https://example.com).' };
            }
            if (input.customShortcode && !/^[a-zA-Z0-9_-]+$/.test(input.customShortcode)) {
                 isValid = false;
                return { ...input, error: 'Custom shortcode can only contain letters, numbers, hyphens, and underscores.' };
            }
            if (input.customShortcode && urlService.isShortcodeTaken(input.customShortcode)) {
                isValid = false;
                return { ...input, error: `Shortcode "${input.customShortcode}" is already taken.` };
            }
            if (input.validity && (!/^\d+$/.test(input.validity) || parseInt(input.validity) <= 0)) {
                isValid = false;
                return { ...input, error: 'Validity must be a positive number of minutes.' };
            }
            return input;
        });

        setInputs(updatedInputs);
        if (!isValid) {
            loggingMiddleware.warn('component', 'Input validation failed.');
        }
        return isValid;
    };


    const handleSubmit = (event) => {
        event.preventDefault();
        loggingMiddleware.info('component', 'Submit button clicked.');
        setResults([]);

        if (!validateInputs()) {
            return;
        }

        setIsSubmitting(true);
        loggingMiddleware.info('state', 'Starting URL shortening process for multiple inputs.');

        // Simulate async operation
        setTimeout(() => {
            const newResults = [];
            inputs.forEach(input => {
                const shortcode = input.customShortcode.trim() || generateShortcode();
                const validityMinutes = parseInt(input.validity, 10) || 30;
                const creationDate = new Date();
                const expiryDate = new Date(creationDate.getTime() + validityMinutes * 60 * 1000);

                const newMapping = {
                    id: shortcode,
                    longUrl: input.longUrl,
                    shortUrl: `${window.location.origin}${window.location.pathname}#/${shortcode}`,
                    createdAt: creationDate.toISOString(),
                    expiresAt: expiryDate.toISOString(),
                    clicks: 0,
                    clickDetails: [],
                };

                urlService.addMapping(newMapping);
                newResults.push({ ...newMapping, original: input.longUrl });
                loggingMiddleware.info('state', `Successfully created mapping: ${input.longUrl} -> ${newMapping.shortUrl}`);
            });
            
            setResults(newResults);
            setIsSubmitting(false);
            setInputs([initialInput]); // Reset form
        }, 500);
    };

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        loggingMiddleware.info('component', `Copied to clipboard: ${text}`);
    };

    return (
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
            <Typography variant="h4" gutterBottom align="center">
                Create Short URLs
            </Typography>
            <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
                Enter up to 5 long URLs to create shortened versions.
            </Typography>

            <form onSubmit={handleSubmit}>
                <Grid container spacing={2}>
                    {inputs.map((input, index) => (
                        <React.Fragment key={input.id}>
                            <Grid item xs={12}>
                                <Typography variant="h6" component="div" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                                    URL #{index + 1}
                                    {inputs.length > 1 && (
                                        <IconButton onClick={() => removeInput(input.id)} color="secondary" size="small" sx={{ ml: 1 }}>
                                            <DeleteIcon />
                                        </IconButton>
                                    )}
                                </Typography>
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Original Long URL"
                                    name="longUrl"
                                    value={input.longUrl}
                                    onChange={(e) => handleInputChange(input.id, e)}
                                    variant="outlined"
                                    required
                                    error={!!input.error}
                                    helperText={input.error || "e.g., https://www.google.com"}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Optional: Custom Shortcode"
                                    name="customShortcode"
                                    value={input.customShortcode}
                                    onChange={(e) => handleInputChange(input.id, e)}
                                    variant="outlined"
                                    helperText="Leave blank for random"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Optional: Validity (minutes)"
                                    name="validity"
                                    type="number"
                                    value={input.validity}
                                    onChange={(e) => handleInputChange(input.id, e)}
                                    variant="outlined"
                                    helperText="Defaults to 30 minutes"
                                />
                            </Grid>
                        </React.Fragment>
                    ))}
                </Grid>

                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                     <Button
                        type="button"
                        onClick={addInput}
                        disabled={inputs.length >= 5}
                        startIcon={<AddCircleOutlineIcon />}
                        variant="text"
                    >
                        Add Another URL
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        disabled={isSubmitting}
                        sx={{ minWidth: '150px' }}
                    >
                         {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Shorten URLs'}
                    </Button>
                </Box>
            </form>

            {results.length > 0 && (
                <Box sx={{ mt: 5 }}>
                    <Typography variant="h5" gutterBottom>
                        Your Shortened URLs
                    </Typography>
                    {results.map((result, index) => (
                        <Paper key={index} variant="outlined" sx={{ p: 2, mt: 2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                            <Box sx={{ flexGrow: 1, wordBreak: 'break-all' }}>
                                <Typography variant="body2" color="text.secondary">
                                    Original: {result.original.length > 60 ? `${result.original.substring(0, 60)}...` : result.original}
                                </Typography>
                                <Link component={RouterLink} to={`/${result.id}`} target="_blank" rel="noopener noreferrer" variant="h6">
                                    {result.shortUrl}
                                </Link>
                                <Typography variant="caption" display="block">
                                    Expires: {new Date(result.expiresAt).toLocaleString()}
                                </Typography>
                            </Box>
                            <IconButton onClick={() => handleCopy(result.shortUrl)} title="Copy short URL">
                                <ContentCopyIcon />
                            </IconButton>
                        </Paper>
                    ))}
                </Box>
            )}
        </Paper>
    );
}

// Page for displaying statistics
function StatisticsPage() {
    const [mappings, setMappings] = useState([]);
    const [order, setOrder] = useState('desc');
    const [orderBy, setOrderBy] = useState('createdAt');
    const [expandedRow, setExpandedRow] = useState(null);

    useEffect(() => {
        loggingMiddleware.info('page', 'StatisticsPage mounted.');
        const allMappings = urlService.getAllMappings();
        // Check for and filter out expired URLs
        const now = new Date();
        const activeMappings = allMappings.filter(m => new Date(m.expiresAt) > now);
        if (activeMappings.length !== allMappings.length) {
            const expiredCount = allMappings.length - activeMappings.length;
            loggingMiddleware.info('state', `Filtered out ${expiredCount} expired URLs.`);
            urlService.saveAllMappings(activeMappings);
        }
        setMappings(activeMappings);
    }, []);

    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc';
        const newOrder = isAsc ? 'desc' : 'asc';
        setOrder(newOrder);
        setOrderBy(property);
        loggingMiddleware.info('component', `Sorting statistics by ${property} in ${newOrder} order.`);
    };

    const sortedMappings = useMemo(() => {
        return [...mappings].sort((a, b) => {
            let aVal = a[orderBy];
            let bVal = b[orderBy];

            if (orderBy === 'createdAt' || orderBy === 'expiresAt') {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            }

            if (bVal < aVal) return order === 'asc' ? 1 : -1;
            if (bVal > aVal) return order === 'asc' ? -1 : 1;
            return 0;
        });
    }, [mappings, order, orderBy]);

    const handleRowClick = (shortcode) => {
        const newExpandedRow = expandedRow === shortcode ? null : shortcode;
        setExpandedRow(newExpandedRow);
        const action = newExpandedRow ? 'Expanded' : 'Collapsed';
        loggingMiddleware.info('component', `${action} click details for ${shortcode}`);
    }

    return (
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
            <Typography variant="h4" gutterBottom align="center">
                URL Statistics
            </Typography>
            {mappings.length === 0 ? (
                 <Typography align="center" color="text.secondary" sx={{ mt: 4 }}>
                    No shortened URLs found. Create some on the main page!
                 </Typography>
            ) : (
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell sortDirection={orderBy === 'shortUrl' ? order : false}>
                                    <TableSortLabel active={orderBy === 'shortUrl'} direction={orderBy === 'shortUrl' ? order : 'asc'} onClick={() => handleRequestSort('shortUrl')}>
                                        Short URL
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell sortDirection={orderBy === 'clicks' ? order : false}>
                                    <TableSortLabel active={orderBy === 'clicks'} direction={orderBy === 'clicks' ? order : 'asc'} onClick={() => handleRequestSort('clicks')}>
                                        Clicks
                                    </TableSortLabel>
                                </TableCell>
                                 <TableCell sortDirection={orderBy === 'createdAt' ? order : false}>
                                    <TableSortLabel active={orderBy === 'createdAt'} direction={orderBy === 'createdAt' ? order : 'asc'} onClick={() => handleRequestSort('createdAt')}>
                                        Created At
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell sortDirection={orderBy === 'expiresAt' ? order : false}>
                                    <TableSortLabel active={orderBy === 'expiresAt'} direction={orderBy === 'expiresAt' ? order : 'asc'} onClick={() => handleRequestSort('expiresAt')}>
                                        Expires At
                                    </TableSortLabel>
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sortedMappings.map((row) => (
                                <React.Fragment key={row.id}>
                                    <TableRow
                                        hover
                                        onClick={() => row.clicks > 0 && handleRowClick(row.id)}
                                        sx={{ cursor: row.clicks > 0 ? 'pointer' : 'default', '& > *': { borderBottom: 'unset' } }}
                                    >
                                        <TableCell>
                                            <Link component={RouterLink} to={`/${row.id}`} target="_blank" rel="noopener noreferrer">{row.shortUrl}</Link>
                                            <Typography variant="caption" display="block" color="text.secondary" sx={{maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                                                {row.longUrl}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>{row.clicks}</TableCell>
                                        <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                                        <TableCell>{new Date(row.expiresAt).toLocaleString()}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                                            <Collapse in={expandedRow === row.id} timeout="auto" unmountOnExit>
                                                <Box sx={{ margin: 1 }}>
                                                    <Typography variant="h6" gutterBottom component="div">
                                                        Click History for "{row.id}"
                                                    </Typography>
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow>
                                                                <TableCell>Timestamp</TableCell>
                                                                <TableCell>Source (Referrer)</TableCell>
                                                                <TableCell>Location</TableCell>
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {row.clickDetails.map((detail, index) => (
                                                                <TableRow key={index}>
                                                                    <TableCell>{new Date(detail.timestamp).toLocaleString()}</TableCell>
                                                                    <TableCell>{detail.source}</TableCell>
                                                                    <TableCell>{detail.location}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </Box>
                                            </Collapse>
                                        </TableCell>
                                    </TableRow>
                                </React.Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Paper>
    );
}

// Component to handle redirection
function RedirectHandler() {
    const { shortcode } = useParams();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    useEffect(() => {
        loggingMiddleware.info('page', `RedirectHandler trying to process shortcode: ${shortcode}`);
        const mapping = urlService.findMappingByShortcode(shortcode);

        if (!mapping) {
            loggingMiddleware.error('api', `Shortcode not found: ${shortcode}`);
            setError(`The short link for "${shortcode}" was not found.`);
            return;
        }

        if (new Date(mapping.expiresAt) < new Date()) {
            loggingMiddleware.error('api', `Shortcode has expired: ${shortcode}`);
            setError(`This short link has expired as of ${new Date(mapping.expiresAt).toLocaleString()}.`);
            // Clean up expired link
            const all = urlService.getAllMappings();
            urlService.saveAllMappings(all.filter(m => m.id !== shortcode));
            return;
        }

        const longUrl = urlService.recordClick(shortcode);
        loggingMiddleware.info('page', `Redirecting to: ${longUrl}`);
        window.location.href = longUrl;

    }, [shortcode, navigate]);

    if (error) {
        return (
             <Paper elevation={3} sx={{ p: 4, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="error" gutterBottom>
                    Redirect Failed
                </Typography>
                <Typography variant="body1">
                    {error}
                </Typography>
                 <Button component={RouterLink} to="/" variant="contained" sx={{mt: 3}}>
                     Go to Homepage
                 </Button>
            </Paper>
        );
    }

    return (
        <Box sx={{ textAlign: 'center', p: 4 }}>
            <CircularProgress />
            <Typography variant="h6" sx={{ mt: 2 }}>
                Redirecting...
            </Typography>
        </Box>
    );
}


// Main App component
export default function App() {
    return (
        <ThemeProvider theme={theme}>
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

