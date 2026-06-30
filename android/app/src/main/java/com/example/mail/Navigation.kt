package com.example.mail

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import com.example.mail.data.MailRepository
import com.example.mail.ui.folder.EmailListScreen
import com.example.mail.ui.folder.FolderListScreen
import com.example.mail.ui.groups.GroupsScreen
import com.example.mail.ui.login.LoginScreen

@Composable
fun MainNavigation() {
  val repository = remember { MailRepository() }
  val backStack = rememberNavBackStack(Login)

  NavDisplay(
    backStack = backStack,
    onBack = { backStack.removeLastOrNull() },
    entryProvider =
      entryProvider {
        entry<Login> {
          LoginScreen(
            repository = repository,
            onLoginSuccess = {
              backStack.add(FolderList)
            }
          )
        }
        entry<FolderList> {
          FolderListScreen(
            repository = repository,
            onFolderClick = { folderId ->
              backStack.add(EmailList(folder = folderId))
            },
            onGroupsClick = {
              backStack.add(Groups)
            },
            onLogoutClick = {
              repository.logout()
              backStack.add(Login)
            }
          )
        }
        entry<Groups> {
          GroupsScreen(
            repository = repository,
            onBackClick = {
              backStack.removeLastOrNull()
            },
            onGroupClick = { groupId ->
              backStack.add(EmailList(groupId = groupId))
            }
          )
        }
        entry<EmailList> { key ->
          EmailListScreen(
            repository = repository,
            folder = key.folder,
            groupId = key.groupId,
            onBackClick = {
              backStack.removeLastOrNull()
            }
          )
        }
      },
  )
}
