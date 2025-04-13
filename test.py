import requests

url = 'http://127.0.0.1:8787/'
image_path = 'image.jpg'  

with open(image_path, 'rb') as img_file:
    files = {'image': (image_path.split('/')[-1], img_file, 'image/jpeg')}
    
    response = requests.post(url+'image', files=files)

print(response.status_code)
print(response.text)