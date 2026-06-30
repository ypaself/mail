package com.example.mail.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class MailRepository {
    private val api: MailApi

    init {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        val client = OkHttpClient.Builder()
            .addInterceptor(logging)
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl("http://10.0.2.2:5050/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        api = retrofit.create(MailApi::class.java)
    }

    private val _token = MutableStateFlow<String?>(null)
    val token: StateFlow<String?> = _token

    private val _counts = MutableStateFlow<CountsResponse?>(null)
    val counts: StateFlow<CountsResponse?> = _counts

    private val _groups = MutableStateFlow<List<Group>>(emptyList())
    val groups: StateFlow<List<Group>> = _groups

    private val _deletedGroups = MutableStateFlow<List<Group>>(emptyList())
    val deletedGroups: StateFlow<List<Group>> = _deletedGroups

    suspend fun login(email: String, password: String): Boolean {
        return try {
            val response = api.login(mapOf("email" to email, "password" to password))
            _token.value = response.token
            fetchCounts()
            fetchGroups()
            fetchDeletedGroups()
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun fetchCounts() {
        val currentToken = _token.value ?: return
        try {
            val response = api.getCounts("Bearer $currentToken")
            _counts.value = response
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    suspend fun fetchGroups() {
        val currentToken = _token.value ?: return
        try {
            val response = api.getGroups("Bearer $currentToken")
            _groups.value = response.groups
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    suspend fun fetchDeletedGroups() {
        val currentToken = _token.value ?: return
        try {
            val response = api.getDeletedGroups("Bearer $currentToken")
            _deletedGroups.value = response.groups
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    suspend fun getEmails(folder: String): List<Email> {
        val currentToken = _token.value ?: return emptyList()
        return try {
            // Updated to use the corrected endpoint pattern api/{folder}
            api.getEmails("Bearer $currentToken", folder).emails
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun getGroupEmails(groupId: Int): List<Email> {
        val currentToken = _token.value ?: return emptyList()
        return try {
            // Updated to use the corrected endpoint pattern api/groups/{id}/emails
            api.getGroupEmails("Bearer $currentToken", groupId).emails
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    fun logout() {
        _token.value = null
        _counts.value = null
        _groups.value = emptyList()
        _deletedGroups.value = emptyList()
    }
}
