// Asset module declarations so fonts/images can be imported (not require()d).
declare module '*.ttf' {
  const asset: number
  export default asset
}
