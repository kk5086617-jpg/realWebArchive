export async function readImage(file) {
  if (!file) return undefined
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Выберите PNG, JPEG, WebP или GIF.')
  if (file.size > 2 * 1024 * 1024) throw new Error('Размер изображения — не более 2 МБ.')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Не удалось прочитать файл.'))
    reader.readAsDataURL(file)
  })
}
