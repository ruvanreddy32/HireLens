// Helper to generate a valid PDF blob from resume metadata for backend submission

export function createResumePdfBlob(resume) {
  const title = (resume?.title || resume?.fileName || 'Candidate Resume').replace(/[()]/g, '')
  const specialization = (resume?.specialization || '').replace(/[()]/g, '')
  const skills = (resume?.skills || []).join(', ').replace(/[()]/g, '')
  const targetRole = (resume?.targetRole || '').replace(/[()]/g, '')

  const streamContent = `BT
/F1 14 Tf
50 720 Td
(${title}) Tj
/F1 10 Tf
0 -22 Td
(Specialization: ${specialization}) Tj
0 -18 Td
(Target Role: ${targetRole}) Tj
0 -18 Td
(Core Competencies: ${skills}) Tj
0 -18 Td
(Verified HireLens Applicant Dossier - Candidate Submission) Tj
ET`

  const streamLength = streamContent.length

  const pdfText = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${streamLength} >>
stream
${streamContent}
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000400 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
490
%%EOF`

  return new Blob([pdfText], { type: 'application/pdf' })
}
