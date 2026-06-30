package com.example.mail.ui.main

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.mail.data.DataRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

sealed interface MainScreenUiState {
    object Loading : MainScreenUiState
    data class Success(val data: List<String>) : MainScreenUiState
    data class Error(val message: String) : MainScreenUiState
}

class MainScreenViewModel(
    private val dataRepository: DataRepository
) : ViewModel() {

    val uiState: StateFlow<MainScreenUiState> = dataRepository.data
        .map<List<String>, MainScreenUiState> { MainScreenUiState.Success(it) }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = MainScreenUiState.Loading
        )
}
