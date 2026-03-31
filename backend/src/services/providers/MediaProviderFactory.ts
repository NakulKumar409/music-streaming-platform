import { MediaProvider } from './interfaces/MediaProvider';
import { CloudinaryProvider } from './CloudinaryProvider';
import { LocalMediaProvider } from './LocalMediaProvider';

export class MediaProviderFactory {
  private static instance: MediaProvider;

  /**
   * Initializes the appropriate provider based on environment variables.
   * Fails fast if configuration is missing or invalid.
   */
  public static initialize(): MediaProvider {
    if (this.instance) {
      return this.instance;
    }

    const providerType = process.env.STORAGE_PROVIDER?.toLowerCase();

    if (!providerType) {
      throw new Error("❌ CRITICAL STARTUP FAILURE: STORAGE_PROVIDER environment variable is missing.");
    }

    switch (providerType) {
      case 'cloudinary':
        console.log("✅ Using Cloudinary as the active Storage Provider");
        this.verifyCloudinaryConfig();
        this.instance = new CloudinaryProvider();
        break;
      case 'local':
        console.log("✅ Using Local Storage as the active Storage Provider (Dev Mock)");
        this.instance = new LocalMediaProvider();
        break;
      case 's3':
      case 'firebase':
        throw new Error(`❌ CRITICAL STARTUP FAILURE: The provider '${providerType}' is defined but not yet implemented.`);
      default:
        throw new Error(`❌ CRITICAL STARTUP FAILURE: Invalid STORAGE_PROVIDER: '${providerType}'. Allowed values: cloudinary, s3, firebase, local.`);
    }

    return this.instance;
  }

  /**
   * Returns the initialized provider instance.
   */
  public static getProvider(): MediaProvider {
    if (!this.instance) {
      this.initialize();
    }
    return this.instance;
  }

  private static verifyCloudinaryConfig(): void {
    const requiredKeys = [
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
      'CLOUDINARY_WEBHOOK_URL' // Explicitly required for Eager Notifications
    ];
    
    // Optional check for PRESET if explicitly depending on it
    if (process.env.CLOUDINARY_UPLOAD_PRESET === undefined) {
      console.warn("⚠️  CLOUDINARY_UPLOAD_PRESET is missing. Unsigned uploads using presets will fail.");
    }
    
    const missingKeys = requiredKeys.filter(key => !process.env[key]);
    if (missingKeys.length > 0) {
      throw new Error(`❌ CRITICAL STARTUP FAILURE: Cloudinary is selected but missing keys: ${missingKeys.join(', ')}`);
    }
  }
}
