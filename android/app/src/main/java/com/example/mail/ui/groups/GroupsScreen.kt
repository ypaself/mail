package com.example.mail.ui.groups

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.mail.data.Group
import com.example.mail.data.MailRepository
import com.example.mail.ui.folder.BadgePill

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GroupsScreen(
    repository: MailRepository,
    onBackClick: () -> Unit,
    onGroupClick: (Int) -> Unit
) {
    val groups by repository.groups.collectAsState()
    val deletedGroups by repository.deletedGroups.collectAsState()

    var activeExpanded by remember { mutableStateOf(true) }
    var deletedExpanded by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        repository.fetchGroups()
        repository.fetchDeletedGroups()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Groups") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // --- Active Groups Section Header ---
            item {
                val totalUnread = groups.sumOf { it.unreadEmailCount }
                val totalScheduled = groups.sumOf { it.scheduleEmailCount }
                val totalTotal = groups.sumOf { it.totalEmailCount }

                SectionHeader(
                    title = "Groups (${groups.size})",
                    isExpanded = activeExpanded,
                    unread = totalUnread,
                    scheduled = totalScheduled,
                    total = totalTotal,
                    onClick = { activeExpanded = !activeExpanded }
                )
            }

            // --- Active Groups List ---
            if (activeExpanded) {
                items(groups) { group ->
                    GroupRow(
                        group = group,
                        isDeleted = false,
                        onClick = { onGroupClick(group.id) }
                    )
                }
            }

            // --- Deleted Groups Section Header ---
            if (deletedGroups.isNotEmpty()) {
                item {
                    val totalDeletedUnread = deletedGroups.sumOf { it.unreadEmailCount }
                    val totalDeletedScheduled = deletedGroups.sumOf { it.scheduleEmailCount }
                    val totalDeletedTotal = deletedGroups.sumOf { it.totalEmailCount }

                    SectionHeader(
                        title = "Deleted groups (${deletedGroups.size})",
                        isExpanded = deletedExpanded,
                        unread = totalDeletedUnread,
                        scheduled = totalDeletedScheduled,
                        total = totalDeletedTotal,
                        modifier = Modifier.alpha(0.6f),
                        onClick = { deletedExpanded = !deletedExpanded }
                    )
                }

                // --- Deleted Groups List ---
                if (deletedExpanded) {
                    items(deletedGroups) { group ->
                        GroupRow(
                            group = group,
                            isDeleted = true,
                            onClick = { onGroupClick(group.id) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun SectionHeader(
    title: String,
    isExpanded: Boolean,
    unread: Int,
    scheduled: Int,
    total: Int,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = if (isExpanded) Icons.Default.KeyboardArrowDown else Icons.Default.KeyboardArrowRight,
            contentDescription = "Toggle",
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(title, style = MaterialTheme.typography.titleMedium, fontSize = 14.sp)
        Spacer(modifier = Modifier.weight(1f))

        Row(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
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
fun GroupRow(
    group: Group,
    isDeleted: Boolean,
    onClick: () -> Unit
) {
    val opacity = if (isDeleted) 0.6f else 1.0f

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp)
            .alpha(opacity),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Parse hex color from group.color
        val colorHex = group.color.removePrefix("#")
        val parsedColor = try {
            Color(android.graphics.Color.parseColor("#$colorHex"))
        } catch (e: Exception) {
            Color.Gray
        }

        // Avatar Circle
        Box(
            modifier = Modifier
                .size(40.dp)
                .background(parsedColor, shape = CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = group.name.take(1).uppercase(),
                color = Color.White,
                style = MaterialTheme.typography.titleMedium
            )
        }

        Spacer(modifier = Modifier.width(16.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(group.name, fontSize = 14.5.sp, style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = "${group.memberCount} member${if (group.memberCount != 1) "s" else ""}",
                fontSize = 11.5.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Row(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (group.unreadEmailCount > 0) {
                BadgePill(text = group.unreadEmailCount.toString(), backgroundColor = Color(0xFF1976D2), contentColor = Color.White)
            }
            if (group.scheduleEmailCount > 0) {
                BadgePill(text = group.scheduleEmailCount.toString(), backgroundColor = Color(0xFFFB8C00), contentColor = Color.White)
            }
            if (group.totalEmailCount > 0) {
                BadgePill(text = group.totalEmailCount.toString(), backgroundColor = Color(0xFFE0E0E0), contentColor = Color(0xFF555555))
            }
        }
    }
}
