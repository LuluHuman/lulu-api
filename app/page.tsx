import { permanentRedirect, RedirectType } from "next/navigation";

export default function Home() {
    permanentRedirect("https://github.com/LuluHuman/rurutbl-react", RedirectType.replace);
}