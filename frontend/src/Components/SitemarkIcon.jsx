import * as React from 'react';
import Box from '@mui/material/Box';

export default function SitemarkIcon() {
  return (
    <Box
      component="img"
      src="/favicon.svg"
      alt="Makeup Agenda"
      // sx={{ height: 40, width: 40, mr: 2, backgroundColor: 'black', borderRadius: 1, p: 0.5 }}
      sx={{ height: 40, width: 40, mr: 2 }}
    />
  );
}
