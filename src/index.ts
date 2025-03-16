import { Hono } from 'hono'
import Images from './routes/image'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.route('/image', Images)

export default app