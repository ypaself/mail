package com.example.mail.data

import kotlinx.coroutines.flow.Flow

interface DataRepository {
    val data: Flow<List<String>>
}
