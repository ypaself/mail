package com.example.mail.data

import com.google.gson.annotations.SerializedName

data class LoginRequest(
    val email: String,
    val password: UserPassword
)

data class UserPassword(
    val password: String
)

data class LoginResponse(
    val token: String,
    val user: UserInfo
)

data class UserInfo(
    val id: Int,
    val email: String,
    val name: String
)

data class FolderCounts(
    val total: Int,
    val unread: Int,
    val scheduled: Int? = null
)

data class CountsResponse(
    val inbox: FolderCounts?,
    val sent: FolderCounts?,
    val starred: FolderCounts?,
    val snoozed: FolderCounts?,
    val drafts: FolderCounts?,
    val archived: FolderCounts?,
    val scheduled: FolderCounts?,
    val spam: FolderCounts?,
    val delete: FolderCounts?,
    val all: FolderCounts?,
    val subscriptions: FolderCounts?,
    val reports: FolderCounts?,
    val groups: FolderCounts?
)

data class Email(
    val id: Int,
    val subject: String?,
    val from: String,
    val to: String,
    val date: String,
    val body: String?,
    val sender: String,
    @SerializedName("is_starred") val isStarred: Boolean,
    @SerializedName("is_read") val isRead: Boolean,
    @SerializedName("scheduled_for") val scheduledFor: String?,
    @SerializedName("is_scheduled") val isScheduled: Boolean,
    @SerializedName("group_id") val groupId: Int?
)

data class EmailsResponse(
    val emails: List<Email>
)

data class Group(
    val id: Int,
    val name: String,
    val color: String,
    val description: String?,
    val photoUrl: String?,
    val emailLocal: String?,
    val groupEmail: String?,
    val memberCount: Int,
    val totalEmailCount: Int,
    val unreadEmailCount: Int,
    val scheduleEmailCount: Int,
    val deletedAt: String? = null
)

data class GroupsResponse(
    val groups: List<Group>
)
