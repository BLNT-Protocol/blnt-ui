import { File } from 'node:buffer';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';

async function listFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }

  return files.sort((left, right) => {
    const leftPath = relative(root, left);
    const rightPath = relative(root, right);
    return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0;
  });
}

const [directoryArgument, pinName, expectedCid] = process.argv.slice(2);
const token = process.env.PINATA_JWT_TOKEN;

if (!directoryArgument || !pinName || !expectedCid || !token) {
  throw new Error('Usage: upload-pinata-directory.mjs <directory> <pin-name> <expected-cid>');
}

const root = resolve(directoryArgument);
const paths = await listFiles(root);
if (paths.length === 0) {
  throw new Error(`Refusing to upload empty directory: ${root}`);
}

const form = new FormData();
for (const path of paths) {
  const relativePath = relative(root, path).split(sep).join('/');
  const content = await readFile(path);
  form.append('file', new File([content], basename(path)), `${pinName}/${relativePath}`);
}
form.append('pinataMetadata', JSON.stringify({ name: pinName }));
form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});

if (!response.ok) {
  const message = await response.text();
  throw new Error(`Pinata directory upload failed with HTTP ${response.status}: ${message}`);
}

const result = await response.json();
if (typeof result.IpfsHash !== 'string' || result.IpfsHash.length === 0) {
  throw new Error('Pinata directory upload did not return an IPFS CID');
}
if (result.IpfsHash !== expectedCid) {
  throw new Error(`Pinata returned CID ${result.IpfsHash}; expected ${expectedCid}`);
}

process.stdout.write(`${result.IpfsHash}\n`);
