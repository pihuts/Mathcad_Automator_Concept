import {
    Paper,
    Typography,
    IconButton,
    Button,
    Box,
    Chip,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Tooltip,
} from '@mui/material';
import {
    FileCopy as FileCopyIcon,
    FolderOpen as FolderOpenIcon,
    OpenInNew as OpenInNewIcon,
    PictureAsPdf as PdfIcon,
    Description as DescriptionIcon,
} from '@mui/icons-material';
import { openFile } from '../services/api';
import { tokens } from '../theme/mui-theme';

interface ResultsListProps {
    files: string[];
    outputDir: string;
}

export function ResultsList({ files, outputDir }: ResultsListProps) {
    if (!files || files.length === 0) return null;

    const handleOpenFile = async (path: string) => {
        try {
            await openFile(path);
        } catch (error) {
            console.error('Could not open file', error);
        }
    };

    const handleOpenFolder = async () => {
        try {
            await openFile(outputDir);
        } catch (error) {
            console.error('Could not open folder', error);
        }
    };

    const reversedFiles = [...files].reverse();

    return (
        <Paper elevation={0} sx={{ p: 2, mt: 2, backgroundColor: tokens.surface.paper, border: '1px solid', borderColor: tokens.neutral[200], borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <FileCopyIcon sx={{ fontSize: 20, color: tokens.accent[600] }} />
                    <Typography variant="caption" sx={{ fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'text.primary' }}>
                        GENERATED OUTPUTS ({files.length})
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    size="small"
                    color="primary"
                    startIcon={<FolderOpenIcon sx={{ fontSize: 16 }} />}
                    onClick={handleOpenFolder}
                >
                    OPEN DIR
                </Button>
            </Box>

            <List sx={{ maxHeight: files.length > 5 ? 200 : 'auto', overflow: 'auto', borderRadius: '12px', border: '1px solid', borderColor: tokens.neutral[200], p: 0 }}>
                {reversedFiles.map((file, idx) => {
                    const fileName = file.split(/[\\/]/).pop();
                    const isPdf = fileName?.toLowerCase().endsWith('.pdf');
                    const isMcdx = fileName?.toLowerCase().endsWith('.mcdx');

                    return (
                        <ListItem
                            key={idx}
                            divider={idx !== reversedFiles.length - 1}
                            sx={{
                                backgroundColor: tokens.surface.paper,
                                transition: 'background-color 150ms ease',
                                '&:hover': { backgroundColor: tokens.neutral[50] },
                            }}
                            secondaryAction={
                                <Tooltip title="Open file" arrow>
                                    <IconButton
                                        color="primary"
                                        onClick={() => handleOpenFile(file)}
                                        aria-label="Open file"
                                        size="small"
                                    >
                                        <OpenInNewIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            }
                        >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                                {isPdf ? <PdfIcon sx={{ fontSize: 18, color: tokens.error.main }} /> :
                                 isMcdx ? <DescriptionIcon sx={{ fontSize: 18, color: tokens.accent[600] }} /> :
                                 <DescriptionIcon sx={{ fontSize: 18, color: tokens.neutral[400] }} />}
                            </ListItemIcon>
                            <ListItemText
                                primary={
                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 500, maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fileName}>
                                            {fileName}
                                        </Typography>
                                        {isPdf && <Chip label="PDF" size="small" color="error" variant="outlined" />}
                                        {isMcdx && <Chip label="MCDX" size="small" color="primary" variant="outlined" />}
                                    </Box>
                                }
                            />
                        </ListItem>
                    );
                })}
            </List>
        </Paper>
    );
}

