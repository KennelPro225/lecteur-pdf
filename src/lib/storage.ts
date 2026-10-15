import path from "path";

/**
 * Returns the uploads directory path.
 * On serverless platforms (Vercel / AWS Lambda), the deployment root is read-only,
 * so we use the writable /tmp/uploads directory.
 */
export function getUploadsDir(): string {
  const isServerless =
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    process.cwd().startsWith("/var/task");

  if (isServerless) {
    return path.join("/tmp", "uploads");
  }
  return path.join(process.cwd(), "uploads");
}

