// Raw-bytes imports for font/logo files, bundled via wrangler's `[[rules]] type = "Data"`.
declare module '*.ttf' {
  const data: ArrayBuffer;
  export default data;
}
declare module '*.png' {
  const data: ArrayBuffer;
  export default data;
}
