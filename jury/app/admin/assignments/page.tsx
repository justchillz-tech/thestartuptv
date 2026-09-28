import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AssignmentManager from "./AssignmentManager";

export default async function AdminAssignmentsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/login");

  const userId = String(claimsData.claims.sub);
  const { data: jury } = await supabase.from("juries").select("role").eq("id", userId).single();
  if (jury?.role !== "admin") redirect("/dashboard");

  return <AssignmentManager />;
}
