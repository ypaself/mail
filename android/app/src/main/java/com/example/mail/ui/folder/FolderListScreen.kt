package com.example.mail.ui.folder

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.mail.data.CountsResponse
import com.example.mail.data.FolderCounts
import com.example.mail.data.MailRepository

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FolderListScreen(
    repository: MailRepository,
    onFolderClick: (String) -> Unit,
    onGroupsClick: () -> Unit,
    onLogoutClick: () -> Unit
) {
    val counts by repository.counts.collectAsState()

    LaunchedEffect(Unit) {
        repository.fetchCounts()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Mail Client") },
                actions = {
                    IconButton(onClick = onLogoutClick) {
                        Icon(Icons.Default.ExitToApp, contentDescription = "Logout")
                    }
                }
            )
        }
    ) { padding ->
        val folderItems = remember(counts) {
            listOf(
                FolderItem("inbox", "Inbox", Icons.Default.Inbox, counts?.inbox),
                FolderItem("sent", "Sent", Icons.Default.Send, counts?.sent),
                FolderItem("starred", "Starred", Icons.Default.Star, counts?.starred),
                FolderItem("snoozed", "Snoozed", Icons.Default.AccessTime, counts?.snoozed),
                FolderItem("drafts", "Drafts", Icons.Default.Drafts, counts?.drafts),
                FolderItem("archived", "Archived", Icons.Default.Archive, counts?.archived),
                FolderItem("scheduled", "Scheduled", Icons.Default.Schedule, counts?.scheduled),
                FolderItem("spam", "Spam", Icons.Default.Report, counts?.spam),
                FolderItem("delete", "Trash", Icons.Default.Delete, counts?.delete)
            )
        }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            items(folderItems) { item ->
                FolderRow(
                    name = item.label,
                    icon = item.icon,
                    counts = item.counts,
                    onClick = { onFolderClick(item.id) }
                )
            }

            item {
                Divider(modifier = Modifier.padding(vertical = 8.dp))
                // Groups folder item with unread, scheduled, and total badges!
                FolderRow(
                    name = "Groups",
                    icon = Icons.Default.Group,
                    counts = counts?.groups,
                    onClick = onGroupsClick
                )
            }
        }
    }
}

data class FolderItem(
    val id: String,
    val label: String,
    val icon: ImageVector,
    val counts: FolderCounts?
)

@Composable
fun FolderRow(
    name: String,
    icon: ImageVector,
    counts: FolderCounts?,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = name, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(modifier = Modifier.width(16.dp))
        Text(name, fontSize = 16.sp, modifier = Modifier.weight(1.5f))

        Row(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            val unread = counts?.unread ?: 0
            val scheduled = counts?.scheduled ?: 0
            val total = counts?.total ?: 0

            if (unread > 0) {
                BadgePill(text = unread.toString(), backgroundColor = Color(0xFF1976D2), contentColor = Color.White)
            }
            if (scheduled > 0) {
                BadgePill(text = scheduled.toString(), backgroundColor = Color(0xFFFB8C00), contentColor = Color.White)
            }
            if (total > 0) {
                BadgePill(text = total.toString(), backgroundColor = Color(0xFFE0E0E0), contentColor = Color(0xFF555555))
            }
        }
    }
}

@Composable
fun BadgePill(
    text: String,
    backgroundColor: Color,
    contentColor: Color
) {
    Box(
        modifier = Modifier
            .background(backgroundColor, shape = RoundedCornerShape(12.dp))
            .padding(horizontal = 8.dp, vertical = 2.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            fontSize = 11.sp,
            color = contentColor,
            style = MaterialTheme.typography.labelMedium
        )
    }
}
