package com.example.mail

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable

@Serializable data object Login : NavKey
@Serializable data object FolderList : NavKey
@Serializable data object Groups : NavKey
@Serializable data class EmailList(val folder: String? = null, val groupId: Int? = null) : NavKey
