package com.example.mail.data

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface MailApi {

    @POST("api/login")
    suspend fun login(
        @Body body: Map<String, String>
    ): LoginResponse

    @GET("api/counts")
    suspend fun getCounts(
        @Header("Authorization") token: String
    ): CountsResponse

    @GET("api/{folder}")
    suspend fun getEmails(
        @Header("Authorization") token: String,
        @Path("folder") folder: String,
        @Query("excludeGroups") excludeGroups: Boolean = true
    ): EmailsResponse

    @GET("api/groups")
    suspend fun getGroups(
        @Header("Authorization") token: String
    ): GroupsResponse

    @GET("api/groups/deleted")
    suspend fun getDeletedGroups(
        @Header("Authorization") token: String
    ): GroupsResponse

    @GET("api/groups/{groupId}/emails")
    suspend fun getGroupEmails(
        @Header("Authorization") token: String,
        @Path("groupId") groupId: Int
    ): EmailsResponse
}
