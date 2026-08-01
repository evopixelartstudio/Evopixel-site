const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ffmpegPath = require('ffmpeg-static');
const inputVideo = path.resolve('video - hero.mp4');
const outputDir = path.resolve('public', 'frames');

console.log('--- Extrator de Frames Evopixel ---');
console.log('Vídeo de entrada:', inputVideo);
console.log('Diretório de saída:', outputDir);

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log('Diretório public/frames criado com sucesso.');
} else {
  // Limpar frames antigos se houver
  const existingFiles = fs.readdirSync(outputDir);
  existingFiles.forEach(file => {
    if (file.endsWith('.webp')) {
      fs.unlinkSync(path.join(outputDir, file));
    }
  });
  console.log('Diretório de saída limpo.');
}

const outputPathPattern = path.join(outputDir, 'frame-%04d.webp');

// Extrair a 15 fps com compressão WebP (qualidade 78) mantendo resolução original (1280x720)
const args = [
  '-i', inputVideo,
  '-vf', 'fps=15',
  '-c:v', 'libwebp',
  '-quality', '78',
  '-preset', 'default',
  '-an',
  '-y',
  outputPathPattern
];

console.log('Executando extração de frames via FFmpeg...');
const startTime = Date.now();
const result = spawnSync(ffmpegPath, args, { encoding: 'utf8' });

if (result.error) {
  console.error('Erro ao executar FFmpeg:', result.error);
  process.exit(1);
}

const duration = ((Date.now() - startTime) / 1000).toFixed(2);
console.log(`Extração concluída em ${duration}s.`);

const generatedFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.webp'));
console.log(`Total de frames gerados: ${generatedFiles.length}`);
if (generatedFiles.length > 0) {
  const sampleFile = path.join(outputDir, generatedFiles[0]);
  let totalSize = 0;
  generatedFiles.forEach(f => {
    totalSize += fs.statSync(path.join(outputDir, f)).size;
  });
  console.log(`Tamanho médio por frame: ${(fs.statSync(sampleFile).size / 1024).toFixed(2)} KB`);
  console.log(`Tamanho total da sequência: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
}
