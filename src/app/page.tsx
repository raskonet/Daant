import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/viewer");
  return null;
}
