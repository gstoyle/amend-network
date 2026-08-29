"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadSession } from "@/lib/auth/session";
import { forumWriteMeta } from "@/lib/forum/request";
import {
  subscribeToThread,
  unsubscribeFromThread,
} from "@/lib/forum/subscribe";
import { createPost, createThread, editPost, flagPost } from "@/lib/forum/write";
import {
  deletePost,
  deleteThread,
  hidePost,
  setThreadLocked,
  setThreadPinned,
} from "@/lib/forum/moderate";

async function claims() {
  const session = await auth();
  return session?.sessionId ? await loadSession(session.sessionId) : null;
}

function fail(path: string, error: string): never {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

export async function createThreadAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const result = await createThread(await claims(), {
    categorySlug: slug,
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    ...(await forumWriteMeta()),
  });
  if (!result.ok) {
    fail(`/app/forum/${slug}/new`, result.error);
  }
  revalidatePath("/app/forum");
  redirect(`/app/forum/t/${result.id}`);
}

export async function createPostAction(formData: FormData): Promise<void> {
  const threadId = String(formData.get("threadId") ?? "");
  const result = await createPost(await claims(), {
    threadId,
    body: String(formData.get("body") ?? ""),
    ...(await forumWriteMeta()),
  });
  if (!result.ok) {
    fail(`/app/forum/t/${threadId}`, result.error);
  }
  revalidatePath(`/app/forum/t/${threadId}`);
  redirect(`/app/forum/t/${threadId}`);
}

export async function editPostAction(formData: FormData): Promise<void> {
  const threadId = String(formData.get("threadId") ?? "");
  const result = await editPost(await claims(), {
    postId: String(formData.get("postId") ?? ""),
    body: String(formData.get("body") ?? ""),
    ...(await forumWriteMeta()),
  });
  if (!result.ok) {
    fail(`/app/forum/t/${threadId}`, result.error);
  }
  revalidatePath(`/app/forum/t/${threadId}`);
  redirect(`/app/forum/t/${threadId}`);
}

export async function flagPostAction(formData: FormData): Promise<void> {
  const threadId = String(formData.get("threadId") ?? "");
  const result = await flagPost(await claims(), {
    postId: String(formData.get("postId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    ...(await forumWriteMeta()),
  });
  if (!result.ok) {
    fail(`/app/forum/t/${threadId}`, result.error);
  }
  revalidatePath(`/app/forum/t/${threadId}`);
  redirect(`/app/forum/t/${threadId}`);
}

export async function subscribeAction(formData: FormData): Promise<void> {
  const threadId = String(formData.get("threadId") ?? "");
  const subscribed = formData.get("subscribed") === "true";
  if (subscribed) {
    await unsubscribeFromThread(await claims(), threadId);
  } else {
    await subscribeToThread(await claims(), threadId);
  }
  revalidatePath(`/app/forum/t/${threadId}`);
  redirect(`/app/forum/t/${threadId}`);
}

export async function lockThreadAction(formData: FormData): Promise<void> {
  const threadId = String(formData.get("threadId") ?? "");
  const result = await setThreadLocked(await claims(), {
    threadId,
    locked: formData.get("locked") !== "true",
    ...(await forumWriteMeta()),
  });
  if (!result.ok) {
    fail(`/app/forum/t/${threadId}`, result.error);
  }
  revalidatePath(`/app/forum/t/${threadId}`);
  redirect(`/app/forum/t/${threadId}`);
}

export async function pinThreadAction(formData: FormData): Promise<void> {
  const threadId = String(formData.get("threadId") ?? "");
  const result = await setThreadPinned(await claims(), {
    threadId,
    pinned: formData.get("pinned") !== "true",
    ...(await forumWriteMeta()),
  });
  if (!result.ok) {
    fail(`/app/forum/t/${threadId}`, result.error);
  }
  revalidatePath(`/app/forum/t/${threadId}`);
  redirect(`/app/forum/t/${threadId}`);
}

export async function hidePostAction(formData: FormData): Promise<void> {
  const threadId = String(formData.get("threadId") ?? "");
  const result = await hidePost(await claims(), {
    postId: String(formData.get("postId") ?? ""),
    ...(await forumWriteMeta()),
  });
  if (!result.ok) {
    fail(`/app/forum/t/${threadId}`, result.error);
  }
  revalidatePath(`/app/forum/t/${threadId}`);
  redirect(`/app/forum/t/${threadId}`);
}

export async function deletePostAction(formData: FormData): Promise<void> {
  const threadId = String(formData.get("threadId") ?? "");
  const result = await deletePost(await claims(), {
    postId: String(formData.get("postId") ?? ""),
    ...(await forumWriteMeta()),
  });
  if (!result.ok) {
    fail(`/app/forum/t/${threadId}`, result.error);
  }
  revalidatePath(`/app/forum/t/${threadId}`);
  redirect(`/app/forum/t/${threadId}`);
}

export async function deleteThreadAction(formData: FormData): Promise<void> {
  const threadId = String(formData.get("threadId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const result = await deleteThread(await claims(), {
    threadId,
    ...(await forumWriteMeta()),
  });
  if (!result.ok) {
    fail(slug ? `/app/forum/${slug}` : `/app/forum/t/${threadId}`, result.error);
  }
  revalidatePath("/app/forum");
  revalidatePath(`/app/forum/${slug}`);
  redirect(`/app/forum/${slug}`);
}
