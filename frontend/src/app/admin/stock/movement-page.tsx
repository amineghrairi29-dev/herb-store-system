import MovementForm from "./movement-form";
import { movementConfigs, type MovementType } from "./movement-config";

export default function MovementPage({ type }: { type: MovementType }) {
  return <main lang="fr" className="min-h-screen flex-1 bg-slate-50 px-4 py-8 font-sans text-slate-900 sm:px-8 sm:py-12">
    <div className="mx-auto max-w-3xl"><MovementForm {...movementConfigs[type]} /></div>
  </main>;
}
