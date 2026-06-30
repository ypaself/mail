package com.example.mail.ui.folder

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.StarBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.mail.data.Email
import com.example.mail.data.MailRepository

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmailListScreen(
    repository: MailRepository,
    folder: String?,
    groupId: Int?,
    onBackClick: () -> Unit
) {
    var emails by remember { mutableStateOf<List<Email>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(folder, groupId) {
        loading = true
        emails = if (groupId != null) {
            repository.getGroupEmails(groupId)
        } else if (folder != null) {
            repository.getEmails(folder)
        } else {
            emptyList()
        }
        loading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(folder?.replaceFirstChar { it.uppercase() } ?: "Group Emails") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        if (loading) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (emails.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("No emails found.")
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            ) {
                items(emails) { email ->
                    EmailRow(email = email)
                    Divider(modifier = Modifier.padding(horizontal = 16.dp), thickness = 0.5.dp, color = Color.LightGray)
                }
            }
        }
    }
}

@Composable
fun EmailRow(email: Email) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { /* Handle email click */ }
            .padding(16.dp),
        verticalAlignment = Alignment.Top
    ) {
        // Sender Avatar
        Box(
            modifier = Modifier
                .size(40.dp)
                .background(Color(0xFFE0E0E0), shape = CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = email.sender.take(1).uppercase(),
                fontWeight = FontWeight.Bold,
                color = Color(0xFF757575)
            )
        }

        Spacer(modifier = Modifier.width(16.dp))

        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = email.sender,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (!email.isRead) FontWeight.Bold else FontWeight.Normal,
                    modifier = Modifier.weight(1f)
                )
                Text(
                    text = email.date,
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.Gray
                )
            }
            Text(
                text = email.subject ?: "(No Subject)",
                style = MaterialTheme.typography.bodySmall,
                fontWeight = if (!email.isRead) FontWeight.Bold else FontWeight.Normal,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = email.body ?: "",
                style = MaterialTheme.typography.bodySmall,
                color = Color.Gray,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }

        Spacer(modifier = Modifier.width(8.dp))

        Icon(
            imageVector = if (email.isStarred) Icons.Default.Star else Icons.Default.StarBorder,
            contentDescription = "Starred",
            tint = if (email.isStarred) Color(0xFFFFB300) else Color.LightGray,
            modifier = Modifier.size(20.dp)
        )
    }
}
