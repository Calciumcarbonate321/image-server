import { Hono } from 'hono';
import { v4 as uuidv4, validate as validateUuid } from 'uuid';
import { R2Bucket } from '@cloudflare/workers-types';

interface Env {
  IMAGES_BUCKET: R2Bucket;
}

const Images = new Hono<{ Bindings: Env }>();

Images.post('/', async (c) => {
  try {
    const formData = await c.req.formData();
    const imageFile = formData.get('image');

    if (!imageFile || !(imageFile instanceof File)) {
      return c.json({ error: 'No image provided or invalid image format' }, 400);
    }

    const imageBytes = await imageFile.arrayBuffer();
    const fileId = uuidv4();
    
    await c.env.IMAGES_BUCKET.put(fileId, imageBytes, {
      httpMetadata: {
        contentType: imageFile.type,
      },
      customMetadata: {
        filename: imageFile.name,
      },
    });

    console.log(`Saved image with ID ${fileId}: ${imageBytes.byteLength} bytes`);

    return c.json({
      success: true,
      message: 'Image saved successfully',
      fileId: fileId,
      filename: imageFile.name,
      size: imageBytes.byteLength,
    });
  } catch (error) {
    console.error('Error processing image:', error);
    return c.json({ error: 'Failed to process image' }, 500);
  }
});

Images.get('/:fileId', async (c) => {
  try {
    const fileId = c.req.param('fileId');

    // Validate fileId as a UUID
    if (!validateUuid(fileId)) {
      return c.json({ error: 'Invalid file ID format' }, 400);
    }

    // Retrieve from R2 bucket
    const object = await c.env.IMAGES_BUCKET.get(fileId);
    
    if (!object) {
      return c.json({ error: 'Image not found' }, 404);
    }

    // Get the image data and metadata
    const imageBytes = await object.arrayBuffer();
    const filename = object.customMetadata?.filename || 'image';
    const contentType = object.httpMetadata?.contentType || 'application/octet-stream';
    
    return new Response(imageBytes, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': imageBytes.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Error retrieving image:', error);
    return c.json({ error: 'Failed to retrieve image' }, 500);
  }
});

export default Images;