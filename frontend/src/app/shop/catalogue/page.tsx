import { redirect } from "next/navigation";

// Preserve old bookmarks without retaining a standalone catalogue UI.
export default function RetiredCataloguePage() { redirect("/shop#products"); }
