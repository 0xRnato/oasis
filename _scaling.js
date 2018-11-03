const scaling = (bufferData, bufferCount) => {
  try {
    const bufferDataLength = Buffer.from(bufferData).length;
    const buffer = Buffer.alloc(bufferDataLength * bufferCount);
    for (let i = 0; i < bufferCount; i++) {
      buffer.write(bufferData, bufferDataLength * i);
      if (i % 1000000 === 0) {
        process.send({ update: true });
      }
    }
    process.send({ result: buffer });
  } catch (err) {
    process.send({ err });
  }
};

process.on("message", msg => {
  if (msg.bufferData && msg.bufferCount) {
    scaling(msg.bufferData, msg.bufferCount);
  }
});
