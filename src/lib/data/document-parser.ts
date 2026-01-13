/**
 * Server-side document parser using officeparser
 * This file should only be imported in server-side code (API routes)
 * because officeparser uses Node.js fs module
 */

import officeParser from 'officeparser';

// Document file extensions supported by officeparser
export const DOCUMENT_EXTENSIONS = ['pdf', 'docx', 'doc', 'pptx', 'ppt', 'odt', 'odp', 'ods', 'rtf'];

// Check if a file extension is a document type
export function isDocumentType(extension: string): boolean {
  return DOCUMENT_EXTENSIONS.includes(extension.toLowerCase());
}

// Result type for document parsing
export interface DocumentParseResult {
  text: string;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    createdAt?: string;
    modifiedAt?: string;
  };
}

/**
 * Parse document files (PDF, DOCX, PPTX, ODT, ODP, ODS, RTF)
 * Returns extracted text content for AI analysis
 */
export async function parseDocument(buffer: Buffer | ArrayBuffer): Promise<DocumentParseResult> {
  try {
    // Convert ArrayBuffer to Buffer if needed
    const nodeBuffer = buffer instanceof Buffer ? buffer : Buffer.from(new Uint8Array(buffer));

    // Parse the document using officeparser
    const ast = await officeParser.parseOffice(nodeBuffer);

    // Extract plain text from the AST
    const text = ast.toText();

    // Extract metadata if available
    const metadata: DocumentParseResult['metadata'] = {};
    if (ast.metadata) {
      // Cast to any since officeparser types may not match exactly
      const meta = ast.metadata as Record<string, unknown>;
      if (meta.title) metadata.title = String(meta.title);
      if (meta.creator) metadata.author = String(meta.creator);
      if (meta.author) metadata.author = String(meta.author);
      if (meta.subject) metadata.subject = String(meta.subject);
      if (meta.created) metadata.createdAt = String(meta.created);
      if (meta.creationDate) metadata.createdAt = String(meta.creationDate);
      if (meta.modified) metadata.modifiedAt = String(meta.modified);
      if (meta.modificationDate) metadata.modifiedAt = String(meta.modificationDate);
    }

    return {
      text,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  } catch (error) {
    throw new Error(
      `Failed to parse document: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
