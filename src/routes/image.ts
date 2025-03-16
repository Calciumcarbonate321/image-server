import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';

const imageStorage: Map<string, ArrayBuffer> = new Map();
const imageMetadata: Map<string, { filename: string, contentType: string }> = new Map();

const Images = new Hono();

Images.post('/', async (c) => {
  try {
    const formData = await c.req.formData();
    
    const imageFile = formData.get('image');
    
    if (!imageFile || !(imageFile instanceof File)) {
      return c.json({ error: 'No image provided or invalid image format' }, 400);
    }
    
    const imageBytes = await imageFile.arrayBuffer();
    
    const fileId = uuidv4();
    
    imageStorage.set(fileId, imageBytes);
    
    imageMetadata.set(fileId, {
      filename: imageFile.name,
      contentType: imageFile.type
    });
    
    console.log(`Saved image with ID ${fileId}: ${imageBytes.byteLength} bytes`);
    
    return c.json({ 
      success: true, 
      message: 'Image saved successfully',
      fileId: fileId,
      filename: imageFile.name,
      size: imageBytes.byteLength
    });
  } catch (error) {
    console.error('Error processing image:', error);
    return c.json({ error: 'Failed to process image' }, 500);
  }
});

Images.get('/:fileId', async (c) => {
  try {
    const fileId = c.req.param('fileId');
    
    if (!imageStorage.has(fileId)) {
      return c.json({ error: 'Image not found' }, 404);
    }
    
    const imageBytes = imageStorage.get(fileId);
    const metadata = imageMetadata.get(fileId);
    
    return new Response(imageBytes, {
      headers: {
        'Content-Type': metadata?.contentType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${metadata?.filename || 'image'}"`,
      }
    });
  } catch (error) {
    console.error('Error retrieving image:', error);
    return c.json({ error: 'Failed to retrieve image' }, 500);
  }
});

export default Images;