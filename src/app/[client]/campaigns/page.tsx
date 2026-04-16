"use client";

import { useParams, redirect } from "next/navigation";

export default function CampaignsRedirect() {
  const { client: clientSlug } = useParams<{ client: string }>();
  redirect(`/${clientSlug}/attribution`);
}
