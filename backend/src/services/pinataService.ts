import axios from 'axios';
import FormData from 'form-data';

export class PinataService {
  private readonly baseURL = 'https://api.pinata.cloud';

  private get PINATA_API_KEY() {
    return process.env.PINATA_API_KEY;
  }

  private get PINATA_SECRET_KEY() {
    return process.env.PINATA_SECRET_KEY;
  }

  async pinFile(fileBuffer: Buffer, fileName: string): Promise<string> {
    try {
      if (!this.PINATA_API_KEY || !this.PINATA_SECRET_KEY) {
        throw new Error('PINATA_API_KEY or PINATA_SECRET_KEY is not configured');
      }

      const formData = new FormData();
      formData.append('file', fileBuffer, fileName);

      const metadata = JSON.stringify({
        name: fileName,
        keyvalues: {
          uploadedAt: new Date().toISOString(),
        },
      });
      formData.append('pinataMetadata', metadata);

      const response = await axios.post(
        `${this.baseURL}/pinning/pinFileToIPFS`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            pinata_api_key: this.PINATA_API_KEY,
            pinata_secret_api_key: this.PINATA_SECRET_KEY,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      return response.data.IpfsHash;
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;
      const statusCode = error.response?.status;
      console.error('Pinata Error:', error.response?.data);
      throw new Error(`Failed to pin file to IPFS (${statusCode}): ${errorMsg}`);
    }
  }

  async pinJSON(jsonData: object, name: string): Promise<string> {
    try {
      if (!this.PINATA_API_KEY || !this.PINATA_SECRET_KEY) {
        throw new Error('PINATA_API_KEY or PINATA_SECRET_KEY is not configured');
      }

      const response = await axios.post(
        `${this.baseURL}/pinning/pinJSONToIPFS`,
        {
          pinataContent: jsonData,
          pinataMetadata: {
            name,
          },
        },
        {
          headers: {
            pinata_api_key: this.PINATA_API_KEY,
            pinata_secret_api_key: this.PINATA_SECRET_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.IpfsHash;
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;
      const statusCode = error.response?.status;
      console.error('Pinata Error:', error.response?.data);
      throw new Error(`Failed to pin JSON to IPFS (${statusCode}): ${errorMsg}`);
    }
  }

  async unpinFile(ipfsHash: string): Promise<void> {
    try {
      await axios.delete(`${this.baseURL}/pinning/unpin/${ipfsHash}`, {
        headers: {
          pinata_api_key: this.PINATA_API_KEY,
          pinata_secret_api_key: this.PINATA_SECRET_KEY,
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to unpin file: ${error.message}`);
    }
  }

  async getPinnedFiles(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseURL}/data/pinList`, {
        headers: {
          pinata_api_key: this.PINATA_API_KEY,
          pinata_secret_api_key: this.PINATA_SECRET_KEY,
        },
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get pinned files: ${error.message}`);
    }
  }
}

export const pinataService = new PinataService();
