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

Images.get("/", async(c)=> {
  try {
    const objects = await c.env.IMAGES_BUCKET.list();
    const images = objects.objects.map(object => ({
      filename: object.key,
      id: object.key
    }));
    return c.json(images);
  } catch (error) {
    console.error('Error listing images:', error);
    return c.json({ error: 'Failed to list images' }, 500);
  }
})

Images.get("/all", async(c)=> {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
<head>
          <title>Image Gallery</title>
          <style>
              .gallery {
                  display: flex;
                  flex-wrap: wrap;
              }
              .gallery img {
                  width: 200px;
                  height: 200px;
                  margin: 10px;
                  object-fit: cover;
              }
              #uploadButton {
                  padding: 5px 10px;
                  font-size: 12px;
                  cursor: pointer;
              }
              .idContainer {
                  border: 1px solid #ccc;
                  padding: 5px;
                  margin: 5px;
              }
          </style>
      </head>
      <body>
          <h1>Image Gallery</h1>
<form id="uploadForm" enctype="multipart/form-data" action="/image/">
              <input type="file" id="imageUpload" name="image" accept="image/*">
              <button type="submit" id="uploadButton">Upload New Image</button>
          </form>
          <div class="gallery" id="imageGallery"></div>
          <script>
async function fetchImages() {
                  const response = await fetch('/image');
                  const images = await response.json();

                  const gallery = document.getElementById('imageGallery');
                  gallery.innerHTML = ''; // Clear existing images

                  images.forEach(image => {
                      const img = document.createElement('img');
                      img.src = \`/image/\${image.filename}\`;
                      img.alt = image.filename;

                      const idElement = document.createElement('p');
                      idElement.textContent = \`Image ID: \${image.id}\`;
                      idElement.classList.add('idContainer');

const imageContainer = document.createElement('div');
                      imageContainer.appendChild(img);
                      imageContainer.appendChild(idElement);

                      const deleteButton = document.createElement('button');
                      deleteButton.textContent = 'Delete';
                      deleteButton.onclick = async () => {
                          try {
                              const response = await fetch(\`/image/\${image.id}\`, {
                                  method: 'DELETE',
                              });

                              if (response.ok) {
                                  alert('Image deleted successfully!');
                                  fetchImages(); // Refresh the image gallery
                              } else {
                                  const errorText = await response.text();
                                  alert(\`Image deletion failed: \${errorText}\`);
                              }
                          } catch (error) {
                              console.error('Error deleting image:', error);
                              alert(\`Image deletion failed: \${error}\`);
                          }
                      };
                      imageContainer.appendChild(deleteButton);

                      gallery.appendChild(imageContainer);
                  });
              }

              document.getElementById('uploadForm').addEventListener('submit', async (event) => {
                  event.preventDefault();
                  const formData = new FormData(event.target);

                  try {
                      const response = await fetch('/image', {
                          method: 'POST',
                          body: formData,
                      });

                      if (response.ok) {
                          alert('Image uploaded successfully!');
                          fetchImages(); // Refresh the image gallery
                      } else {
                          const errorText = await response.text();
                          alert(\`Image upload failed: \${errorText}\`);
                      }
                  } catch (error) {
                      console.error('Error uploading image:', error);
                      alert(\`Image upload failed: \${error}\`);
                  }
              });

              fetchImages();
          </script>
      </body>
      </html>
    `;
    return new Response(htmlContent, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
      },
    });
  } catch (error) {
    console.error('Error listing images:', error);
    return c.json({ error: 'Failed to list images' }, 500);
  }
})

Images.delete('/:fileId', async (c) => {
  try {
    const fileId = c.req.param('fileId');

    if (!validateUuid(fileId)) {
      return c.json({ error: 'Invalid file ID format' }, 400);
    }

    await c.env.IMAGES_BUCKET.delete(fileId);

    return c.json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    return c.json({ error: 'Failed to delete image' }, 500);
  }
});

Images.get('/:fileId', async (c) => {
  try {
    const fileId = c.req.param('fileId');
    const objects = await c.env.IMAGES_BUCKET.list();
    console.log(objects)
    if (!validateUuid(fileId)) {
      return c.json({ error: 'Invalid file ID format' }, 400);
    }

    const object = await c.env.IMAGES_BUCKET.get(fileId);
    
    if (!object) {
      return c.json({ error: 'Image not found' }, 404);
    }

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
