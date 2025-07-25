'use client';

import { Button, Typography, Box, Container } from '@mui/material';
import FileUpload from '../components/FileUpload';

export default function Page() {
  return (
    <main>
      <Container maxWidth="lg">
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="h3" component="h1" gutterBottom>
            PPT-to-Shorts AI Generator
          </Typography>
          <Typography variant="h6" color="text.secondary" paragraph>
            Upload your PowerPoint and generate engaging short videos
          </Typography>
          <Button variant="contained" size="large" sx={{ mt: 2 }}>
            Upload PPT
          </Button>
        </Box>
        <FileUpload />
      </Container>
    </main>
  );
}
