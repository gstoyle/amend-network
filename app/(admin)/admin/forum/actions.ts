"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadSession } from "@/lib/auth/session";
import { createForumCategory } from "@/lib/forum/categories";
import {
  deletePost,
  hidePost,
  keepFlaggedPost,
} from "@/lib/forum/moderate";
import { forumWriteMeta } from "@/lib/forum/request";

async function claims() {
  const session = await auth();
  return session?.sessionId ? await loadSession(session.sessionId) : null;
}

export async function createCategoryAction(formData: FormData): Promise<void> {
  const result = await createForumCategory(await claims(), {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? ""),
    visibility: formData.getAll("visibility").map(String),
    ...(await forumWriteMeta()),
  });
  if (!result.ok) {
    redirect(`/admin/forum?error=${encodeURIComponent(result.error)}`);
  }
  revalidatePath("/admin/forum");
  redirect("/admin/forum");
}

export async function keepFlagAction(formData: FormData): Promise<void> {
  const result = await keepFlaggedPost(await claims(), {
    postId: String(formData.get("postId") ?? ""),
    ...(await forumWriteMeta()),
  });
  if (!result.ok) {
    redirect(`/admin/forum/flags?error=${encodeURIComponent(result.error)}`);
  }
  revalidatePath("/admin/forum/flags");
  redirect("/admin/forum/flags");
}

export async function hideFlaggedAction(formData: FormData): Promise<void> {
  const result = await hidePost(await claims(), {
    postId: String(formData.get("postId") ?? ""),
    ...(await forumWriteMeta()),
  });
  if (!result.ok) {
    redirect(`/admin/forum/flags?error=${encodeURIComponent(result.error)}`);
  }
  revalidatePath("/admin/forum/flags");
  redirect("/admin/forum/flags");
}

export async function deleteFlaggedAction(formData: FormData): Promise<void> {
  const result = await deletePost(await claims(), {
    postId: String(formData.get("postId") ?? ""),
    ...(await forumWriteMeta()),
  });
  if (!result.ok) {
    redirect(`/admin/forum/flags?error=${encodeURIComponent(result.error)}`);
  }
  revalidatePath("/admin/forum/flags");
  redirect("/admin/forum/flags");
}
