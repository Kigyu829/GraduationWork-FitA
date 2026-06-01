import torch
import torchvision.transforms as T
from PIL import Image
import sys
sys.path.append('model')
from model import create_model
import config

ckpt = torch.load('weights/food_detector_v1.pth', map_location=config.DEVICE)
model = create_model(ckpt['num_classes'])
model.load_state_dict(ckpt['model_state_dict'])
model.eval()

img = Image.open(r'C:\AIHub_Food_Dataset\Validation\images\VS1\A\13\A13001\02\정위\A_13_A13001_가자미구이_02_09.jpg').convert('RGB')
print(f'이미지 크기: {img.size}')
tensor = T.ToTensor()(img).to(config.DEVICE)
with torch.no_grad():
    out = model([tensor])[0]

scores = out['scores'].cpu().tolist()
labels = out['labels'].cpu().tolist()
idx_to_name = {int(k): v for k, v in ckpt['idx_to_name'].items()}

print(f'총 detection 수: {len(scores)}')
print('Top-10:')
for s, l in sorted(zip(scores, labels), reverse=True)[:10]:
    print(f'  {idx_to_name.get(l, str(l))}: {s:.4f}')
