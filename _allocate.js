const allocate = (bufferData, bufferCount) => {
  try {
    const bufferDataLength = Buffer.from(bufferData).length;
    const buffer = Buffer.alloc(bufferDataLength * bufferCount, bufferData);
    process.send({ result: buffer });
  } catch (err) {
    process.send({ err });
  }
};

process.on("message", msg => {
  if (msg.bufferData && msg.bufferCount) {
    allocate(msg.bufferData, msg.bufferCount);
  }
});
