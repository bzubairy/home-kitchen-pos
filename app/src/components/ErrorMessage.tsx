export default function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{message}</p>
}
