import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../lib/prisma';
import { ALLOWED_MIME_TYPES } from '../utils/fileValidation';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

export class GoogleDriveService {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Generate the OAuth2 authorization URL
   */
  getAuthUrl(userId: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent', // Force consent screen to get refresh token
      state: userId, // Pass userId in state to identify user in callback
    });
  }

  /**
   * Exchange authorization code for tokens and store them
   */
  async handleOAuthCallback(code: string, userId: string): Promise<void> {
    const { tokens } = await this.oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      throw new Error('Failed to obtain access token');
    }

    const expiresAt = tokens.expiry_date 
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000); // Default to 1 hour from now

    // Store or update tokens in database
    await prisma.googleDriveToken.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiresAt,
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt,
      },
    });
  }

  /**
   * Get valid OAuth2 client for a user (refreshes token if needed)
   */
  async getAuthenticatedClient(userId: string): Promise<OAuth2Client> {
    const tokenData = await prisma.googleDriveToken.findUnique({
      where: { userId },
    });

    if (!tokenData) {
      throw new Error('Google Drive not connected. Please authenticate first.');
    }

    this.oauth2Client.setCredentials({
      access_token: tokenData.accessToken,
      refresh_token: tokenData.refreshToken || undefined,
    });

    // Check if token is expired or about to expire (within 5 minutes)
    const now = new Date();
    const expiryThreshold = new Date(now.getTime() + 5 * 60 * 1000);
    
    if (tokenData.expiresAt < expiryThreshold) {
      // Refresh the token
      try {
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        
        if (credentials.access_token) {
          const newExpiresAt = credentials.expiry_date 
            ? new Date(credentials.expiry_date)
            : new Date(Date.now() + 3600 * 1000);

          await prisma.googleDriveToken.update({
            where: { userId },
            data: {
              accessToken: credentials.access_token,
              refreshToken: credentials.refresh_token || undefined,
              expiresAt: newExpiresAt,
            },
          });

          this.oauth2Client.setCredentials(credentials);
        }
      } catch (error) {
        console.error('Error refreshing token:', error);
        throw new Error('Failed to refresh Google Drive token. Please re-authenticate.');
      }
    }

    return this.oauth2Client;
  }

  /**
   * List files from Google Drive
   */
  async listFiles(
    userId: string, 
    pageSize: number = 50, 
    pageToken?: string,
    query?: string
  ): Promise<{
    files: Array<{
      id: string;
      name: string;
      mimeType: string;
      size?: string;
      modifiedTime?: string;
      webViewLink?: string;
      iconLink?: string;
    }>;
    nextPageToken?: string;
  }> {
    const auth = await this.getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth });

    // Build query - only show allowed file types
    const mimeTypeQueries = ALLOWED_MIME_TYPES.map(mimeType => `mimeType='${mimeType}'`);
    let fileQuery = `trashed=false and (${mimeTypeQueries.join(' or ')})`;
    
    // Add user's custom query if provided
    if (query) {
      fileQuery = `${fileQuery} and (name contains '${query}')`;
    }

    const response = await drive.files.list({
      pageSize,
      pageToken,
      q: fileQuery,
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, iconLink)',
      orderBy: 'modifiedTime desc',
    });

    return {
      files: response.data.files?.map(file => ({
        id: file.id!,
        name: file.name!,
        mimeType: file.mimeType!,
        size: file.size ?? undefined,
        modifiedTime: file.modifiedTime ?? undefined,
        webViewLink: file.webViewLink ?? undefined,
        iconLink: file.iconLink ?? undefined,
      })) || [],
      nextPageToken: response.data.nextPageToken || undefined,
    };
  }

  /**
   * Download a file from Google Drive
   */
  async downloadFile(userId: string, fileId: string): Promise<{
    fileName: string;
    mimeType: string;
    buffer: Buffer;
    size: number;
  }> {
    const auth = await this.getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth });

    // Get file metadata
    const metadata = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size',
    });

    const originalMimeType = metadata.data.mimeType!;
    let fileName = metadata.data.name!;
    let finalMimeType = originalMimeType;
    let response;

    // Check if it's a Google Workspace file that needs to be exported
    if (originalMimeType === 'application/vnd.google-apps.document') {
      // Export Google Docs as PDF
      response = await drive.files.export(
        { fileId, mimeType: 'application/pdf' },
        { responseType: 'arraybuffer' }
      );
      finalMimeType = 'application/pdf';
      // Add .pdf extension if not present
      if (!fileName.toLowerCase().endsWith('.pdf')) {
        fileName = `${fileName}.pdf`;
      }
    } else if (originalMimeType === 'application/vnd.google-apps.spreadsheet') {
      // Export Google Sheets as XLSX
      response = await drive.files.export(
        { fileId, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        { responseType: 'arraybuffer' }
      );
      finalMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      // Add .xlsx extension if not present
      if (!fileName.toLowerCase().endsWith('.xlsx')) {
        fileName = `${fileName}.xlsx`;
      }
    } else {
      // Download regular files (PDFs, images, Office files)
      response = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );
    }

    const buffer = Buffer.from(response.data as ArrayBuffer);

    return {
      fileName,
      mimeType: finalMimeType,
      buffer,
      size: buffer.length,
    };
  }

  /**
   * Check if user has connected Google Drive
   */
  async isConnected(userId: string): Promise<boolean> {
    const tokenData = await prisma.googleDriveToken.findUnique({
      where: { userId },
    });

    return tokenData !== null;
  }

  /**
   * Disconnect Google Drive (remove tokens)
   */
  async disconnect(userId: string): Promise<void> {
    await prisma.googleDriveToken.delete({
      where: { userId },
    });
  }

  /**
   * Get user info from Google
   */
  async getUserInfo(userId: string): Promise<{
    email: string;
    name: string;
    picture?: string;
  }> {
    const auth = await this.getAuthenticatedClient(userId);
    const oauth2 = google.oauth2({ version: 'v2', auth });

    const { data } = await oauth2.userinfo.get();

    return {
      email: data.email!,
      name: data.name!,
      picture: data.picture ?? undefined,
    };
  }
}

export const googleDriveService = new GoogleDriveService();

