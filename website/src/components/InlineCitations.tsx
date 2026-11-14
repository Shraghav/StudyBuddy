import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Collapse,
  Paper,
  useTheme
} from '@mui/material';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { CitationItem } from '../types';

interface InlineCitationsProps {
  citations: CitationItem[];
}

export const InlineCitations: React.FC<InlineCitationsProps> = ({ citations }) => {
  const theme = useTheme();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!citations || citations.length === 0) return null;

  // Generate distinct color accents for citations based on page or ID
  const getColorAccent = (index: number) => {
    const palette = [
      { bg: 'rgba(99, 102, 241, 0.12)', text: '#6366f1', border: 'rgba(99, 102, 241, 0.3)' },
      { bg: 'rgba(14, 165, 233, 0.12)', text: '#0ea5e9', border: 'rgba(14, 165, 233, 0.3)' },
      { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
      { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
      { bg: 'rgba(236, 72, 153, 0.12)', text: '#ec4899', border: 'rgba(236, 72, 153, 0.3)' }
    ];
    return palette[index % palette.length];
  };

  return (
    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px dashed ${theme.palette.divider}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
        <AutoStoriesOutlinedIcon sx={{ fontSize: '0.9rem', color: theme.palette.text.secondary }} />
        <Typography variant="caption" sx={{ fontWeight: 600, color: theme.palette.text.secondary, letterSpacing: 0.5 }}>
          GROUNDED SOURCES & CITATIONS
        </Typography>
      </Box>

      {/* Citation Tag Pills */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {citations.map((c, idx) => {
          const color = getColorAccent(idx);
          const isExpanded = expandedId === c.id;

          return (
            <Chip
              key={c.id || idx}
              label={`Page ${c.page} • Source ${c.id}`}
              size="small"
              onClick={() => setExpandedId(isExpanded ? null : c.id)}
              onDelete={() => setExpandedId(isExpanded ? null : c.id)}
              deleteIcon={
                <ExpandMoreIcon
                  sx={{
                    transform: isExpanded ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s ease',
                    color: `${color.text} !important`
                  }}
                />
              }
              sx={{
                bgcolor: color.bg,
                color: color.text,
                border: `1px solid ${color.border}`,
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: color.bg,
                  filter: 'brightness(0.95)'
                }
              }}
            />
          );
        })}
      </Box>

      {/* Expanded Snippet Detail */}
      {citations.map((c) => {
        const isExpanded = expandedId === c.id;

        // Clean out raw OCR and chunk header artifacts
        const cleanSnippet = (c.snippet || '')
          .replace(/---\s*\[Page\s*\d+\]\s*---/gi, '')
          .replace(/\[Page OCR\]:?/gi, '')
          .replace(/^[A-Za-z0-9_\-/\\]+:[^\n]*\n?/gm, '')
          .replace(/^(Cheatsheets\/[^\s]+|\w+\/\w+:\w+)/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        return (
          <Collapse key={`snippet-${c.id}`} in={isExpanded}>
            <Paper
              variant="outlined"
              sx={{
                mt: 1.5,
                p: 1.5,
                borderRadius: 2,
                bgcolor: theme.palette.mode === 'dark' ? '#1e293b' : '#f1f5f9',
                borderColor: theme.palette.divider
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, color: theme.palette.primary.main, display: 'block', mb: 0.5 }}>
                Snippet from Page {c.page} â€¢ Source {c.id}
              </Typography>
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: theme.palette.text.primary, fontSize: '0.85rem', lineHeight: 1.6 }}>
                  "{cleanSnippet || c.snippet}"
                </Typography>
            </Paper>
          </Collapse>
        );
      })}
    </Box>
  );
};

