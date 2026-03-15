import { permanentRedirect, RedirectType } from "next/navigation";

export default function Home() {
    permanentRedirect("https://luluhoy.tech", RedirectType.replace);
}